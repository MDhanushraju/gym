"""
STEP 1 + 2 + 3: Reference Squat Extraction & Template Builder
=============================================================
Run:  python reference/extract_reference.py
Output: reference/squat_template.json + reference/extraction_report.json

For each reference video:
 - Run MediaPipe Pose Landmarker frame-by-frame
 - Detect and segment reps automatically
 - Compute scale-free measurements per frame and per phase
 - Build a template with mean/min/max/tolerance per metric per phase

Re-run any time you add new clips to reference/ — template improves automatically.
"""

import json, math, os, sys, cv2, numpy as np
from pathlib import Path
from collections import defaultdict

# ─── MediaPipe setup ─────────────────────────────────────────────────────────
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.vision import RunningMode

TASK_PATH = str(Path(__file__).parent.parent / "public" / "models" / "pose_landmarker_lite.task")
if not os.path.exists(TASK_PATH):
    TASK_PATH = str(Path(__file__).parent.parent / "pose_landmarker_lite.task")
REFERENCE_DIR = Path(__file__).parent
OUTPUT_TEMPLATE = REFERENCE_DIR / "squat_template.json"
OUTPUT_REPORT   = REFERENCE_DIR / "extraction_report.json"

# Tolerance margin: widen the observed spread by this fraction
TOLERANCE_MARGIN = 0.15
# Minimum fraction of template bottom depth to count a rep
MIN_DEPTH_FRACTION = 0.60
# Calibration: standing upright threshold (hipY < kneeY - fraction of legLength)
UPRIGHT_HIP_KNEE_GAP = 0.08

# ─── Landmark index constants ─────────────────────────────────────────────────
LM = {
    'nose':0,'l_eye_i':1,'r_eye_i':2,'l_ear':7,'r_ear':8,
    'l_shoulder':11,'r_shoulder':12,
    'l_elbow':13,'r_elbow':14,
    'l_wrist':15,'r_wrist':16,
    'l_hip':23,'r_hip':24,
    'l_knee':25,'r_knee':26,
    'l_ankle':27,'r_ankle':28,
    'l_heel':29,'r_heel':30,
    'l_foot_i':31,'r_foot_i':32,
}

def dist(a, b, aspect=1.0):
    """Euclidean distance with aspect-ratio correction (x coords scaled by aspect)."""
    return math.sqrt(((a[0]-b[0])*aspect)**2 + (a[1]-b[1])**2)

def angle3(a, b, c, aspect=1.0):
    """3-point angle at vertex b, with aspect correction."""
    ba = np.array([(a[0]-b[0])*aspect, a[1]-b[1]])
    bc = np.array([(c[0]-b[0])*aspect, c[1]-b[1]])
    n1, n2 = np.linalg.norm(ba), np.linalg.norm(bc)
    if n1 < 1e-6 or n2 < 1e-6:
        return 180.0
    return math.degrees(math.acos(np.clip(np.dot(ba,bc)/(n1*n2), -1, 1)))

def vec_angle_from_vertical(a, b, aspect=1.0):
    """Angle of segment a->b from the vertical (degrees). 0 = straight down."""
    dx = (b[0]-a[0]) * aspect
    dy = b[1] - a[1]  # positive = down in normalized coords
    return math.degrees(math.atan2(abs(dx), abs(dy)))

def lm_xy(lm_list, idx):
    """Return (x, y) of landmark by index, or None if not visible."""
    if idx >= len(lm_list): return None
    p = lm_list[idx]
    vis = getattr(p, 'visibility', None)
    if vis is not None and vis < 0.4:
        return None
    return (p.x, p.y)

def mid(a, b):
    if a is None or b is None: return None
    return ((a[0]+b[0])/2, (a[1]+b[1])/2)

# ─── Frame metrics computation ────────────────────────────────────────────────

def compute_frame_metrics(lm_list, aspect, view='side'):
    """
    Compute all scale-free metrics for one frame.
    Returns dict of metric_name -> float, or None if insufficient landmarks.
    aspect = frame_width / frame_height  (corrects x vs y scales in normalized coords)
    """
    m = {}

    # ── Body segments ──────────────────────────────────────────────────────
    ls = lm_xy(lm_list, LM['l_shoulder'])
    rs = lm_xy(lm_list, LM['r_shoulder'])
    lh = lm_xy(lm_list, LM['l_hip'])
    rh = lm_xy(lm_list, LM['r_hip'])
    lk = lm_xy(lm_list, LM['l_knee'])
    rk = lm_xy(lm_list, LM['r_knee'])
    la = lm_xy(lm_list, LM['l_ankle'])
    ra = lm_xy(lm_list, LM['r_ankle'])
    lhe = lm_xy(lm_list, LM['l_heel'])
    rhe = lm_xy(lm_list, LM['r_heel'])

    # ── Choose dominant side (higher visibility) ───────────────────────────
    # Side view: typically one side is more visible
    def vis(idx):
        if idx >= len(lm_list): return 0
        return getattr(lm_list[idx], 'visibility', 0) or 0

    vis_l = vis(LM['l_hip']) + vis(LM['l_knee']) + vis(LM['l_ankle'])
    vis_r = vis(LM['r_hip']) + vis(LM['r_knee']) + vis(LM['r_ankle'])
    side = 'L' if vis_l >= vis_r else 'R'
    m['dominant_side'] = 0 if side == 'L' else 1

    h  = lh if side == 'L' else rh
    k  = lk if side == 'L' else rk
    a  = la if side == 'L' else ra
    s  = ls if side == 'L' else rs
    he = lhe if side == 'L' else rhe

    # Bilateral midpoints
    hip_mid = mid(lh, rh)
    sho_mid = mid(ls, rs)
    kne_mid = mid(lk, rk)
    ank_mid = mid(la, ra)

    if h is None or k is None or a is None or s is None:
        return None

    # ── Body size measurements (always computed, used for normalization) ────
    femur_len = dist(h, k, aspect)         # hip-to-knee
    shank_len = dist(k, a, aspect)         # knee-to-ankle
    leg_len   = dist(h, a, aspect)         # hip-to-ankle
    torso_len = dist(s, h, aspect)         # shoulder-to-hip
    # Store for normalization
    m['femur_len']   = round(femur_len, 4)
    m['shank_len']   = round(shank_len, 4)
    m['leg_len']     = round(leg_len, 4)
    m['torso_len']   = round(torso_len, 4)
    if leg_len < 0.01:
        return None   # degenerate frame

    # ── Primary signal: hip descent ────────────────────────────────────────
    # Will be normalized per-rep against standing baseline
    m['hip_y_raw']   = round(h[1], 4)   # raw normalized Y (increases downward)

    # ── SIDE-VIEW metrics ─────────────────────────────────────────────────
    if view in ('side', 'auto'):
        # Knee angle: hip-knee-ankle
        m['knee_angle'] = round(angle3(h, k, a, aspect), 2)
        # Hip angle: shoulder-hip-knee
        m['hip_angle']  = round(angle3(s, h, k, aspect), 2)
        # Torso inclination from vertical (0° = upright, 90° = horizontal)
        m['torso_incl'] = round(vec_angle_from_vertical(h, s, aspect), 2)
        # Shank inclination from vertical
        m['shank_incl'] = round(vec_angle_from_vertical(a, k, aspect), 2)
        # Hip-to-knee vertical gap / femur length  (1.0 = standing, <1 = squatting)
        hk_vert = abs(k[1] - h[1])  # normalized Y diff
        m['hk_vert_ratio'] = round(hk_vert / femur_len if femur_len > 0 else 0, 4)
        # Knee forward travel = (knee X - ankle X) / shank length
        # Positive = knee ahead of ankle; side view only
        kx_ax = (k[0] - a[0]) * aspect
        m['knee_fwd_travel'] = round(kx_ax / shank_len if shank_len > 0 else 0, 4)
        # Heel stability: heel X relative to ankle X (normalized by foot length proxy)
        if he is not None:
            m['heel_lift_ratio'] = round((a[1] - he[1]) / femur_len if femur_len > 0 else 0, 4)
        else:
            m['heel_lift_ratio'] = None

    # ── FRONT-VIEW metrics ─────────────────────────────────────────────────
    if view in ('front', 'auto'):
        if lk is not None and rk is not None and la is not None and ra is not None:
            hip_w  = dist(lh, rh, aspect) if lh and rh else None
            kne_w  = dist(lk, rk, aspect)
            ank_w  = dist(la, ra, aspect)
            sho_w  = dist(ls, rs, aspect) if ls and rs else None
            # Knee-cave: knee width / ankle width (<1 = knees caving in)
            m['knee_cave_ratio'] = round(kne_w / ank_w if ank_w > 0 else 1, 4)
            # Stance width / shoulder width
            if sho_w and sho_w > 0:
                m['stance_sho_ratio'] = round(ank_w / sho_w, 4)
            # Hip symmetry
            if lh and rh:
                m['hip_tilt'] = round(abs(lh[1] - rh[1]) / leg_len, 4)
            # Shoulder width growth as squatting (compare to standing baseline later)
            if sho_w:
                m['sho_width_raw'] = round(sho_w, 4)

    return m


# ─── Rep segmentation ────────────────────────────────────────────────────────

def segment_reps(frames_data, standing_hip_y, leg_len, bottom_threshold=0.30, return_threshold=0.15, start_threshold=0.15):
    """
    Given per-frame {timestamp, hip_y_raw, ...}, find rep segments.
    A rep: hip descends > bottom_threshold * leg_len, then returns to within return_threshold.
    Returns list of rep dicts: {start_i, bottom_i, end_i, start_t, bottom_t, end_t, peak_descent}
    """
    # Compute smoothed descent ratio per frame
    n = len(frames_data)
    descent = []
    for f in frames_data:
        if f.get('hip_y_raw') is not None and leg_len > 0:
            descent.append((f['hip_y_raw'] - standing_hip_y) / leg_len)
        else:
            descent.append(0.0)

    # EMA smoothing
    alpha = 0.25
    smoothed = [descent[0]]
    for i in range(1, n):
        smoothed.append(alpha * descent[i] + (1 - alpha) * smoothed[-1])

    reps = []
    state = 'STANDING'
    rep_start = 0
    bottom_i = 0
    peak_descent = 0

    for i, d in enumerate(smoothed):
        if state == 'STANDING':
            if d >= start_threshold:   # started descending
                state = 'DESCENDING'
                rep_start = i
                peak_descent = d
        elif state == 'DESCENDING':
            if d > peak_descent:
                peak_descent = d
                bottom_i = i
            if d >= bottom_threshold:
                state = 'BOTTOM'
            elif d < return_threshold and i > rep_start + 5:
                # Aborted descent — not a full rep
                state = 'STANDING'
                peak_descent = 0
        elif state == 'BOTTOM':
            if d > peak_descent:
                peak_descent = d
                bottom_i = i
            if d <= return_threshold:   # returned to standing
                dur = frames_data[i]['timestamp'] - frames_data[rep_start]['timestamp']
                if dur >= 0.5 and peak_descent >= bottom_threshold:
                    reps.append({
                        'start_i':    rep_start,
                        'bottom_i':   bottom_i,
                        'end_i':      i,
                        'start_t':    frames_data[rep_start]['timestamp'],
                        'bottom_t':   frames_data[bottom_i]['timestamp'],
                        'end_t':      frames_data[i]['timestamp'],
                        'peak_descent': round(peak_descent, 3),
                    })
                state = 'STANDING'
                peak_descent = 0

    return reps, smoothed


# ─── Phase labelling ────────────────────────────────────────────────────────

def label_phase(i, rep, descent_signal):
    """Return phase label for frame index i within a rep."""
    start = rep['start_i']
    bot   = rep['bottom_i']
    end   = rep['end_i']
    if i <= start:
        return 'STANDING'
    if i <= (start + bot) // 2:
        return 'MID_DESCENT'
    if i <= bot:
        return 'BOTTOM'
    if i <= (bot + end) // 2:
        return 'MID_ASCENT'
    return 'STANDING'


# ─── Scale-free metrics per phase ────────────────────────────────────────────

def collect_phase_metrics(frames_data, rep, phase, standing_hip_y, leg_len):
    """Collect all metrics for a given phase of a rep. Returns list of metric dicts."""
    start = rep['start_i']
    bot   = rep['bottom_i']
    end   = rep['end_i']
    result = []
    for i in range(start, end + 1):
        p = label_phase(i, rep, None)
        if p != phase:
            continue
        f = frames_data[i]
        entry = {}
        for k, v in f.items():
            if k in ('timestamp', 'frame_i', 'dominant_side', 'hip_y_raw',
                     'femur_len', 'shank_len', 'leg_len', 'torso_len'):
                continue
            if v is None:
                continue
            # Normalize hip-related metrics by leg_len
            entry[k] = v
        # Compute normalized hip descent
        if f.get('hip_y_raw') is not None and leg_len > 0:
            entry['hip_descent_ratio'] = round(
                (f['hip_y_raw'] - standing_hip_y) / leg_len, 4)
        result.append(entry)
    return result


# ─── Template accumulator ────────────────────────────────────────────────────

class TemplateAccumulator:
    def __init__(self):
        # phase -> metric -> list of values
        self.data = defaultdict(lambda: defaultdict(list))
        self.rep_count = 0
        self.video_count = 0
        self.rep_durations = []
        self.descent_curves = []  # list of list of (progress_0_1, descent_ratio)
        self.body_props = []      # femur/torso/shank ratios per ref clip

    def add_rep(self, frames_data, rep, standing_hip_y, leg_len, femur_len, torso_len):
        self.rep_count += 1
        self.rep_durations.append(rep['end_t'] - rep['start_t'])
        for phase in ['STANDING', 'MID_DESCENT', 'BOTTOM', 'MID_ASCENT']:
            vals = collect_phase_metrics(frames_data, rep, phase, standing_hip_y, leg_len)
            for v in vals:
                for mname, mval in v.items():
                    if isinstance(mval, (int, float)):
                        self.data[phase][mname].append(mval)
        # Descent curve (progress vs descent ratio)
        total_frames = max(1, rep['end_i'] - rep['start_i'])
        curve = []
        for i in range(rep['start_i'], rep['end_i'] + 1):
            progress = (i - rep['start_i']) / total_frames
            f = frames_data[i]
            dr = (f['hip_y_raw'] - standing_hip_y) / leg_len if f.get('hip_y_raw') and leg_len > 0 else 0
            curve.append({'progress': round(progress, 3), 'descent': round(dr, 3)})
        self.descent_curves.append(curve)
        # Body proportions
        if leg_len > 0:
            self.body_props.append({
                'femur_torso': round(femur_len / torso_len, 3) if torso_len > 0 else None,
                'femur_leg':   round(femur_len / leg_len, 3),
                'torso_leg':   round(torso_len / leg_len, 3) if leg_len > 0 else None,
            })

    def build_template(self, margin=TOLERANCE_MARGIN):
        """Build template JSON from accumulated data."""
        template = {
            'version': '1.0',
            'low_sample_size': self.rep_count < 10,
            'rep_count': self.rep_count,
            'video_count': self.video_count,
            'rep_durations': {
                'mean': round(float(np.mean(self.rep_durations)), 2),
                'min':  round(float(np.min(self.rep_durations)), 2),
                'max':  round(float(np.max(self.rep_durations)), 2),
            },
            'phases': {},
            'descent_curve': self._build_avg_curve(),
            'body_proportions': self._build_body_props(),
            'tolerance_margin': margin,
        }
        for phase, metrics in self.data.items():
            template['phases'][phase] = {}
            for mname, vals in metrics.items():
                if len(vals) < 2:
                    continue
                mn, mx = float(np.min(vals)), float(np.max(vals))
                spread = mx - mn
                tol = spread * margin
                template['phases'][phase][mname] = {
                    'mean':    round(float(np.mean(vals)), 4),
                    'std':     round(float(np.std(vals)), 4),
                    'min':     round(mn, 4),
                    'max':     round(mx, 4),
                    'tol_min': round(mn - tol, 4),
                    'tol_max': round(mx + tol, 4),
                    'n':       len(vals),
                }
        # Key depth metric for counting
        bottom_phase = template['phases'].get('BOTTOM', {})
        if 'hip_descent_ratio' in bottom_phase:
            template['bottom_depth'] = bottom_phase['hip_descent_ratio']
        return template

    def _build_avg_curve(self):
        """Average descent curves to 50 progress points."""
        if not self.descent_curves:
            return []
        points = np.linspace(0, 1, 50)
        curves_interp = []
        for curve in self.descent_curves:
            prgs = [p['progress'] for p in curve]
            dscnts = [p['descent'] for p in curve]
            if len(prgs) < 2:
                continue
            interp = np.interp(points, prgs, dscnts)
            curves_interp.append(interp)
        if not curves_interp:
            return []
        avg = np.mean(curves_interp, axis=0)
        std = np.std(curves_interp, axis=0)
        return [{'p': round(float(p), 3), 'mean': round(float(m), 3), 'std': round(float(s), 3)}
                for p, m, s in zip(points, avg, std)]

    def _build_body_props(self):
        if not self.body_props:
            return {}
        femur_torso = [b['femur_torso'] for b in self.body_props if b.get('femur_torso')]
        femur_leg   = [b['femur_leg']   for b in self.body_props if b.get('femur_leg')]
        return {
            'femur_torso_ratio': {
                'mean': round(float(np.mean(femur_torso)), 3) if femur_torso else None,
                'std':  round(float(np.std(femur_torso)), 3)  if femur_torso else None,
            },
            'femur_leg_ratio': {
                'mean': round(float(np.mean(femur_leg)), 3) if femur_leg else None,
                'std':  round(float(np.std(femur_leg)), 3)  if femur_leg else None,
            },
        }


# ─── Single video extraction ──────────────────────────────────────────────────

def extract_video(video_path: Path, view: str = 'auto') -> dict:
    """
    Run MediaPipe on a video. Return extraction result dict with frames + reps.
    view: 'side', 'front', 'auto'
    """
    print(f"\n{'='*60}")
    print(f"Processing: {video_path.name}")
    cap = cv2.VideoCapture(str(video_path))
    fps   = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height= int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    aspect = width / height   # for aspect-ratio-correct math
    print(f"  {width}x{height}  {fps:.1f}fps  {total} frames  {total/fps:.1f}s")
    print(f"  Portrait: {height > width}  Aspect: {aspect:.3f}")

    # Build MediaPipe landmarker
    base_opts = mp_python.BaseOptions(model_asset_path=TASK_PATH)
    opts = mp_vision.PoseLandmarkerOptions(
        base_options=base_opts,
        running_mode=RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    landmarker = mp_vision.PoseLandmarker.create_from_options(opts)

    frames_data = []
    frame_i = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        timestamp_ms = int(frame_i / fps * 1000)
        # Convert BGR→RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect_for_video(mp_img, timestamp_ms)

        frame_dict = {
            'frame_i':    frame_i,
            'timestamp':  round(frame_i / fps, 3),
            'has_pose':   False,
        }

        if result.pose_landmarks and len(result.pose_landmarks) > 0:
            lm_list = result.pose_landmarks[0]
            metrics = compute_frame_metrics(lm_list, aspect, view)
            if metrics:
                frame_dict['has_pose'] = True
                frame_dict.update(metrics)

        frames_data.append(frame_dict)
        frame_i += 1

    cap.release()
    landmarker.close()

    total_pose_frames = sum(1 for f in frames_data if f['has_pose'])
    print(f"  Pose detected in {total_pose_frames}/{frame_i} frames ({100*total_pose_frames//max(1,frame_i)}%)")

    # ── Estimate standing baseline ─────────────────────────────────────────
    # Standing: largest hip Y values in early frames (Y increases downward; hip Y should be LOWER
    # i.e. numerically smaller when standing in portrait? No — wait:
    # In MediaPipe normalized coords: (0,0) is TOP-LEFT, Y increases downward.
    # Standing: hips are HIGH (small Y). Squatting: hips drop (larger Y).
    # We want the MINIMUM hip_y_raw from stable early frames as the standing baseline.
    pose_frames = [f for f in frames_data if f.get('has_pose') and f.get('hip_y_raw')]

    if len(pose_frames) < 10:
        print(f"  WARNING: too few pose frames ({len(pose_frames)}). Skipping.")
        return {'video': video_path.name, 'error': 'too few pose frames', 'frames': frames_data, 'reps': []}

    # Standing baseline: minimum hip Y over first 10% and last 10% of video
    # (before and after the action starts, excluding walking-in period)
    n = len(pose_frames)
    # Look at first 30% of frames for standing (skip very first few to avoid walking in)
    candidate_standing = sorted(pose_frames, key=lambda f: f['hip_y_raw'])
    # Take the 15th percentile hip Y (smallest Y = highest position = standing)
    p15 = int(0.15 * len(candidate_standing))
    standing_frames = candidate_standing[:max(1, p15)]
    standing_hip_y = float(np.mean([f['hip_y_raw'] for f in standing_frames]))
    leg_len_vals   = [f['leg_len']   for f in standing_frames if f.get('leg_len', 0) > 0]
    femur_len_vals = [f['femur_len'] for f in standing_frames if f.get('femur_len', 0) > 0]
    torso_len_vals = [f['torso_len'] for f in standing_frames if f.get('torso_len', 0) > 0]
    leg_len    = float(np.median(leg_len_vals))   if leg_len_vals   else 0.3
    femur_len  = float(np.median(femur_len_vals)) if femur_len_vals else 0.15
    torso_len  = float(np.median(torso_len_vals)) if torso_len_vals else 0.15

    print(f"  Standing baseline — hipY: {standing_hip_y:.3f}  legLen: {leg_len:.3f}  femur: {femur_len:.3f}  torso: {torso_len:.3f}")

    # ── Rep segmentation ───────────────────────────────────────────────────
    reps, smoothed_descent = segment_reps(pose_frames, standing_hip_y, leg_len, bottom_threshold=0.30)
    max_descent = max(smoothed_descent) if smoothed_descent else 0
    print(f"  Max descent ratio: {max_descent:.3f}")
    print(f"  Reps found: {len(reps)}")
    for i, rep in enumerate(reps):
        dur = rep['end_t'] - rep['start_t']
        print(f"    Rep {i+1}: {rep['start_t']:.2f}s → {rep['end_t']:.2f}s  ({dur:.2f}s)  peak_descent={rep['peak_descent']:.3f}")

    return {
        'video':          video_path.name,
        'width':          width,
        'height':         height,
        'fps':            fps,
        'total_frames':   frame_i,
        'pose_frames':    total_pose_frames,
        'aspect':         aspect,
        'standing_hip_y': standing_hip_y,
        'leg_len':        leg_len,
        'femur_len':      femur_len,
        'torso_len':      torso_len,
        'frames':         pose_frames,
        'reps':           reps,
        'smoothed_descent': [round(d, 3) for d in smoothed_descent],
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Find all reference videos
    video_configs = []
    for p in sorted(REFERENCE_DIR.glob("*.mp4")):
        if 'side' in p.stem:
            video_configs.append((p, 'side'))
        elif 'front' in p.stem:
            video_configs.append((p, 'front'))
        else:
            video_configs.append((p, 'auto'))

    if not video_configs:
        print("No .mp4 files found in reference/ folder.")
        sys.exit(1)

    print(f"Found {len(video_configs)} reference clip(s):")
    for p, v in video_configs:
        print(f"  {p.name}  (view={v})")

    accumulator = TemplateAccumulator()
    report_clips = []

    for video_path, view in video_configs:
        result = extract_video(video_path, view)
        report_clips.append({k: v for k, v in result.items() if k not in ('frames', 'smoothed_descent')})

        if 'error' in result:
            continue

        accumulator.video_count += 1
        for rep in result['reps']:
            accumulator.add_rep(
                result['frames'],
                rep,
                result['standing_hip_y'],
                result['leg_len'],
                result['femur_len'],
                result['torso_len'],
            )

    # Build template
    template = accumulator.build_template()
    with open(OUTPUT_TEMPLATE, 'w') as f:
        json.dump(template, f, indent=2)
    
    # Also save to public/reference/ for Vite frontend serving
    public_template_dir = Path(__file__).parent.parent / "public" / "reference"
    public_template_dir.mkdir(parents=True, exist_ok=True)
    with open(public_template_dir / "squat_template.json", 'w') as f:
        json.dump(template, f, indent=2)
    
    print(f"\n✓ Template saved: {OUTPUT_TEMPLATE}")
    print(f"✓ Public template saved: {public_template_dir / 'squat_template.json'}")
    print(f"  Reps in template: {template['rep_count']}")
    print(f"  Low sample size: {template['low_sample_size']}")
    if 'BOTTOM' in template['phases']:
        bot = template['phases']['BOTTOM']
        if 'hip_descent_ratio' in bot:
            hd = bot['hip_descent_ratio']
            print(f"  Bottom depth ratio: mean={hd['mean']:.3f} range=[{hd['tol_min']:.3f}, {hd['tol_max']:.3f}]")
        if 'knee_angle' in bot:
            ka = bot['knee_angle']
            print(f"  Knee angle at bottom: mean={ka['mean']:.1f}° range=[{ka['tol_min']:.1f}, {ka['tol_max']:.1f}]°")
        if 'torso_incl' in bot:
            ti = bot['torso_incl']
            print(f"  Torso inclination at bottom: mean={ti['mean']:.1f}° range=[{ti['tol_min']:.1f}, {ti['tol_max']:.1f}]°")

    # Save report
    report = {'clips': report_clips, 'template_summary': {
        'rep_count': template['rep_count'],
        'video_count': template['video_count'],
        'low_sample_size': template['low_sample_size'],
        'phases': list(template['phases'].keys()),
    }}
    with open(OUTPUT_REPORT, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"✓ Report saved: {OUTPUT_REPORT}")

if __name__ == '__main__':
    main()

