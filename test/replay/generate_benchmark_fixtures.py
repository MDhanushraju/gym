"""
Generates benchmark landmark sequence fixtures for the offline push-up replay harness:
1. pushup_5reps.json: 5 complete repetitions with natural cadence (assert: 5 reps)
2. negative_random.json: Random non-pushup movements, standing upright, hip pumps, head bobbing (assert: 0 reps)
3. pushup_incomplete.json: 2 complete reps + 2 incomplete reps (assert: exactly 2 valid reps, 2 incomplete reps logged)
4. user_recorded_pushup.json: Landmarks extracted from the user's real recorded video
"""

import json, os, math, shutil

FIXTURES_DIR = r'C:\Users\91741\projects\gym\test\fixtures'
os.makedirs(FIXTURES_DIR, exist_ok=True)

def create_base_plank(elbow_angle=160, sh_y=0.42, hip_y=0.48, ank_y=0.55):
    # Base 33 MediaPipe landmarks in a horizontal push-up plank
    # Side-facing, x spanning 0.35 to 0.85
    lm = []
    for i in range(33):
        lm.append({'x': 0.5, 'y': 0.5, 'z': 0.0, 'visibility': 0.95})
    
    # Head / Nose
    lm[0] = {'x': 0.28, 'y': sh_y - 0.05, 'z': -0.1, 'visibility': 0.98}
    
    # Shoulders (11 left, 12 right)
    lm[11] = {'x': 0.38, 'y': sh_y, 'z': 0.05, 'visibility': 0.98}
    lm[12] = {'x': 0.40, 'y': sh_y + 0.01, 'z': -0.05, 'visibility': 0.85}
    
    # Elbows (13 left, 14 right) - flex backward
    # We position elbow such that angle(shoulder, elbow, wrist) matches elbow_angle
    # Wrist on ground at y = 0.68
    wrist_y = 0.68
    wrist_x = 0.38
    lm[15] = {'x': wrist_x, 'y': wrist_y, 'z': 0.05, 'visibility': 0.98}
    lm[16] = {'x': wrist_x + 0.02, 'y': wrist_y, 'z': -0.05, 'visibility': 0.85}
    
    # Position elbow based on flexion
    flex_rad = math.radians(180 - elbow_angle)
    elbow_x = wrist_x - 0.12 * math.sin(flex_rad)
    elbow_y = (sh_y + wrist_y) / 2 + 0.08 * math.cos(flex_rad)
    lm[13] = {'x': elbow_x, 'y': elbow_y, 'z': 0.05, 'visibility': 0.98}
    lm[14] = {'x': elbow_x + 0.02, 'y': elbow_y, 'z': -0.05, 'visibility': 0.85}
    
    # Hips (23 left, 24 right)
    lm[23] = {'x': 0.60, 'y': hip_y, 'z': 0.05, 'visibility': 0.95}
    lm[24] = {'x': 0.62, 'y': hip_y + 0.01, 'z': -0.05, 'visibility': 0.85}
    
    # Knees (25 left, 26 right)
    lm[25] = {'x': 0.74, 'y': (hip_y + ank_y) / 2, 'z': 0.05, 'visibility': 0.95}
    lm[26] = {'x': 0.76, 'y': (hip_y + ank_y) / 2, 'z': -0.05, 'visibility': 0.85}
    
    # Ankles (27 left, 28 right)
    lm[27] = {'x': 0.88, 'y': ank_y, 'z': 0.05, 'visibility': 0.95}
    lm[28] = {'x': 0.90, 'y': ank_y, 'z': -0.05, 'visibility': 0.85}
    
    return lm

# ==============================================================================
# 1. FIXTURE: pushup_5reps.json (5 clean reps, 30 fps)
# ==============================================================================
frames_5reps = []
fps = 30.0
frame_idx = 0

# Initial calibration plank hold (1.0s = 30 frames)
for f in range(30):
    lm = create_base_plank(elbow_angle=162, sh_y=0.40, hip_y=0.46, ank_y=0.54)
    frames_5reps.append({
        'frame_index': frame_idx,
        'timestamp': frame_idx / fps,
        'has_pose': True,
        'landmarks': lm
    })
    frame_idx += 1

# 5 Full Repetitions (each rep ~1.8s = 54 frames)
for rep in range(5):
    rep_frames = 54
    for i in range(rep_frames):
        p = i / rep_frames
        # Smooth cosine cycle: 0 at top, 1 at bottom, 0 at top
        cycle = (1.0 - math.cos(p * 2 * math.pi)) / 2.0
        
        # Lockout at top (162°), depth at bottom (85°)
        elbow_angle = 162.0 - cycle * 77.0
        # Shoulder descends 0.16 (which is ~0.75x of torso length 0.22)
        sh_y = 0.40 + cycle * 0.16
        hip_y = 0.46 + cycle * 0.12
        
        lm = create_base_plank(elbow_angle=elbow_angle, sh_y=sh_y, hip_y=hip_y, ank_y=0.54)
        frames_5reps.append({
            'frame_index': frame_idx,
            'timestamp': frame_idx / fps,
            'has_pose': True,
            'landmarks': lm
        })
        frame_idx += 1

with open(os.path.join(FIXTURES_DIR, 'pushup_5reps.json'), 'w') as f:
    json.dump(frames_5reps, f, indent=2)
print(f'Generated pushup_5reps.json ({len(frames_5reps)} frames, 5 reps)')

# ==============================================================================
# 2. FIXTURE: negative_random.json (Should yield 0 reps)
# Includes: standing upright, arm waving, hip pumps, random jitter
# ==============================================================================
frames_neg = []
frame_idx = 0

# A. Standing upright (30 frames)
for i in range(30):
    lm = []
    for j in range(33): lm.append({'x': 0.5, 'y': 0.5, 'z': 0, 'visibility': 0.95})
    lm[11] = {'x': 0.45, 'y': 0.28, 'z': 0, 'visibility': 0.98}
    lm[12] = {'x': 0.55, 'y': 0.28, 'z': 0, 'visibility': 0.98}
    lm[13] = {'x': 0.42, 'y': 0.45, 'z': 0, 'visibility': 0.98}
    lm[14] = {'x': 0.58, 'y': 0.45, 'z': 0, 'visibility': 0.98}
    lm[15] = {'x': 0.40, 'y': 0.60, 'z': 0, 'visibility': 0.98}
    lm[16] = {'x': 0.60, 'y': 0.60, 'z': 0, 'visibility': 0.98}
    lm[23] = {'x': 0.46, 'y': 0.56, 'z': 0, 'visibility': 0.98}
    lm[24] = {'x': 0.54, 'y': 0.56, 'z': 0, 'visibility': 0.98}
    lm[27] = {'x': 0.46, 'y': 0.92, 'z': 0, 'visibility': 0.98}
    lm[28] = {'x': 0.54, 'y': 0.92, 'z': 0, 'visibility': 0.98}
    frames_neg.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

# B. Hip Pump without shoulder descent (in plank, hips pump up and down) (40 frames)
for i in range(40):
    p = (1.0 - math.cos(i / 20.0 * 2 * math.pi)) / 2.0
    hip_sag = p * 0.18 # Hips drop 0.18 while shoulders stay stationary
    lm = create_base_plank(elbow_angle=162, sh_y=0.40, hip_y=0.46 + hip_sag, ank_y=0.54)
    frames_neg.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

# C. Wrist/arm twitches without body descent (40 frames)
for i in range(40):
    p = math.sin(i / 10.0 * math.pi)
    lm = create_base_plank(elbow_angle=158 + p * 12, sh_y=0.40, hip_y=0.46, ank_y=0.54)
    frames_neg.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

with open(os.path.join(FIXTURES_DIR, 'negative_random.json'), 'w') as f:
    json.dump(frames_neg, f, indent=2)
print(f'Generated negative_random.json ({len(frames_neg)} frames, 0 reps expected)')

# ==============================================================================
# 3. FIXTURE: pushup_incomplete.json (2 full reps + 2 incomplete reps = 2 valid reps)
# ==============================================================================
frames_incomp = []
frame_idx = 0

# Calibration hold (20 frames)
for f in range(20):
    lm = create_base_plank(elbow_angle=160, sh_y=0.40, hip_y=0.46, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

# Rep 1: Full Clean Rep (Valid -> Count 1)
for i in range(50):
    p = (1.0 - math.cos(i / 50.0 * 2 * math.pi)) / 2.0
    lm = create_base_plank(elbow_angle=160.0 - p * 75.0, sh_y=0.40 + p * 0.16, hip_y=0.46 + p * 0.12, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

# Rep 2: Incomplete Depth (Shallow: only goes down 20%, never reaches bottom, returns to top) -> Incomplete
for i in range(40):
    p = ((1.0 - math.cos(i / 40.0 * 2 * math.pi)) / 2.0) * 0.22 # only 22% depth!
    lm = create_base_plank(elbow_angle=160.0 - p * 75.0, sh_y=0.40 + p * 0.16, hip_y=0.46 + p * 0.12, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

# Rep 3: Full Clean Rep (Valid -> Count 2)
for i in range(50):
    p = (1.0 - math.cos(i / 50.0 * 2 * math.pi)) / 2.0
    lm = create_base_plank(elbow_angle=160.0 - p * 75.0, sh_y=0.40 + p * 0.16, hip_y=0.46 + p * 0.12, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

# Rep 4: Incomplete Lockout (Reaches full depth, rises halfway to 125°, then collapses without locking out) -> Incomplete
for i in range(30): # Descent to full depth
    p = i / 30.0
    lm = create_base_plank(elbow_angle=160.0 - p * 75.0, sh_y=0.40 + p * 0.16, hip_y=0.46 + p * 0.12, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1
for i in range(15): # Ascend only halfway (to 125°, p=0.5)
    p = 1.0 - (i / 15.0) * 0.5
    lm = create_base_plank(elbow_angle=160.0 - p * 75.0, sh_y=0.40 + p * 0.16, hip_y=0.46 + p * 0.12, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1
for i in range(20): # Collapse back down to bottom
    p = 0.5 + (i / 20.0) * 0.5
    lm = create_base_plank(elbow_angle=160.0 - p * 75.0, sh_y=0.40 + p * 0.16, hip_y=0.46 + p * 0.12, ank_y=0.54)
    frames_incomp.append({'frame_index': frame_idx, 'timestamp': frame_idx / fps, 'has_pose': True, 'landmarks': lm})
    frame_idx += 1

with open(os.path.join(FIXTURES_DIR, 'pushup_incomplete.json'), 'w') as f:
    json.dump(frames_incomp, f, indent=2)
print(f'Generated pushup_incomplete.json ({len(frames_incomp)} frames, exactly 2 full reps expected)')

# ==============================================================================
# 4. FIXTURE: user_recorded_pushup.json (Copy from user_pushup_landmarks.json)
# ==============================================================================
user_raw = r'C:\Users\91741\projects\gym\user_pushup_landmarks.json'
if os.path.exists(user_raw):
    shutil.copy(user_raw, os.path.join(FIXTURES_DIR, 'user_recorded_pushup.json'))
    print('Copied real user landmarks to test/fixtures/user_recorded_pushup.json')
