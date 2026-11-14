import os
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

# Canvas setup
WIDTH = 1280
HEIGHT = 720
FPS = 30

# Colors (Nordic / FormFit palette)
BG_COLOR = (248, 250, 248)       # Soft off-white
CARD_BG = (255, 255, 255)        # Pure white
PRIMARY = (127, 0, 255)          # Royal Purple #7F00FF
SECONDARY = (22, 163, 74)        # Emerald Sage #16A34A
ACCENT_BLUE = (37, 99, 235)      # Royal Blue
WARNING = (234, 88, 12)          # Orange Alert
TEXT_MAIN = (30, 41, 59)         # Slate 800
TEXT_MUTED = (100, 116, 139)     # Slate 500
BORDER_COLOR = (226, 232, 240)   # Slate 200
DARK_PANEL = (15, 23, 42)        # Slate 900
GHOST_SKELETON = (147, 51, 234)  # Translucent Purple

# Load system font
try:
    font_large = ImageFont.truetype("arial.ttf", 36)
    font_title = ImageFont.truetype("arial.ttf", 28)
    font_subtitle = ImageFont.truetype("arial.ttf", 20)
    font_body = ImageFont.truetype("arial.ttf", 16)
    font_bold = ImageFont.truetype("arialbd.ttf", 22)
    font_huge_bold = ImageFont.truetype("arialbd.ttf", 38)
    font_badge = ImageFont.truetype("arialbd.ttf", 14)
except Exception:
    font_large = ImageFont.load_default()
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()
    font_body = ImageFont.load_default()
    font_bold = ImageFont.load_default()
    font_huge_bold = ImageFont.load_default()
    font_badge = ImageFont.load_default()

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def draw_header(draw, title, subtitle, badge="FORMFIT AI COACH"):
    # App top navigation bar
    draw_rounded_rect(draw, (40, 25, WIDTH - 40, 85), radius=14, fill=CARD_BG, outline=BORDER_COLOR, width=1)
    
    # Logo / Badge
    draw_rounded_rect(draw, (55, 38, 220, 72), radius=8, fill=(243, 232, 255))
    draw.text((68, 46), badge, font=font_badge, fill=PRIMARY)
    
    # Title & Subtitle
    draw.text((240, 37), title, font=font_title, fill=TEXT_MAIN)
    draw.text((240, 63), subtitle, font=font_body, fill=TEXT_MUTED)
    
    # Client-Side Security badge
    draw_rounded_rect(draw, (WIDTH - 250, 38, WIDTH - 55, 72), radius=8, fill=(240, 253, 244), outline=(187, 247, 208))
    draw.text((WIDTH - 235, 46), "100% Client-Side Privacy", font=font_badge, fill=SECONDARY)

def draw_squat_figure(draw, cx, cy, scale, phase_progress, is_ghost=False, knee_flaw=False):
    """
    phase_progress: 0.0 (standing upright) to 1.0 (bottom of squat parallel)
    """
    hip_drop = phase_progress * 80 * scale
    knee_bend = phase_progress * 65 * scale
    
    head_y = cy - 140 * scale + hip_drop * 0.85
    neck_y = head_y + 25 * scale
    hip_y = cy - 30 * scale + hip_drop
    
    hip_x_offset = 20 * scale * phase_progress
    hip_x = cx - hip_x_offset
    
    knee_x = cx + (35 * scale) - (15 * scale * phase_progress if knee_flaw else 0)
    knee_y = cy + 40 * scale + hip_drop * 0.35
    
    ankle_x = cx + 15 * scale
    ankle_y = cy + 120 * scale
    
    color = GHOST_SKELETON if is_ghost else (PRIMARY if not knee_flaw else WARNING)
    joint_col = (192, 132, 252) if is_ghost else (SECONDARY if not knee_flaw else (239, 68, 68))
    line_w = int(5 * scale)
    
    # Spine & Torso
    draw.line([(cx, neck_y), (hip_x, hip_y)], fill=color, width=line_w)
    
    # Femur / Thigh
    draw.line([(hip_x, hip_y), (knee_x, knee_y)], fill=color, width=line_w)
    
    # Tibia / Shin
    draw.line([(knee_x, knee_y), (ankle_x, ankle_y)], fill=color, width=line_w)
    
    # Arm / Chest balance
    arm_end_x = cx + 60 * scale
    arm_end_y = neck_y + 35 * scale + (15 * scale * phase_progress)
    draw.line([(cx, neck_y + 10 * scale), (arm_end_x, arm_end_y)], fill=color, width=int(line_w * 0.8))
    
    # Head
    head_r = int(18 * scale)
    draw.ellipse([cx - head_r, head_y - head_r, cx + head_r, head_y + head_r], fill=color)
    
    # Joints
    for pt in [(hip_x, hip_y), (knee_x, knee_y), (ankle_x, ankle_y), (cx, neck_y)]:
        r = int(7 * scale)
        draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=joint_col, outline=CARD_BG, width=2)
        
    # Angle arc at knee
    angle = int(170 - phase_progress * 85)
    return angle, (knee_x, knee_y)

def draw_pushup_figure(draw, cx, cy, scale, phase_progress, is_ghost=False, sag_flaw=False):
    """
    Pushup side-view stick figure: phase_progress 0.0 (top plank) to 1.0 (bottom chest to deck)
    """
    elbow_drop = phase_progress * 55 * scale
    chest_drop = phase_progress * 50 * scale
    
    feet_x = cx - 110 * scale
    feet_y = cy + 50 * scale
    
    hip_sag = 25 * scale if sag_flaw else 0
    hip_x = cx - 30 * scale
    hip_y = cy + 20 * scale + (chest_drop * 0.6) + hip_sag
    
    shoulder_x = cx + 50 * scale
    shoulder_y = cy + 5 * scale + chest_drop
    
    hand_x = cx + 45 * scale
    hand_y = cy + 55 * scale
    
    elbow_x = cx + 15 * scale - (15 * scale * phase_progress)
    elbow_y = cy + 25 * scale + elbow_drop
    
    color = GHOST_SKELETON if is_ghost else (PRIMARY if not sag_flaw else WARNING)
    joint_col = (192, 132, 252) if is_ghost else (SECONDARY if not sag_flaw else (239, 68, 68))
    line_w = int(5 * scale)
    
    # Legs (Ankles to Hips)
    draw.line([(feet_x, feet_y), (hip_x, hip_y)], fill=color, width=line_w)
    
    # Torso (Hips to Shoulder)
    draw.line([(hip_x, hip_y), (shoulder_x, shoulder_y)], fill=color, width=line_w)
    
    # Arms (Shoulder to Elbow to Hand)
    draw.line([(shoulder_x, shoulder_y), (elbow_x, elbow_y)], fill=color, width=line_w)
    draw.line([(elbow_x, elbow_y), (hand_x, hand_y)], fill=color, width=line_w)
    
    # Head
    head_x = shoulder_x + 25 * scale
    head_y = shoulder_y - 12 * scale
    head_r = int(14 * scale)
    draw.ellipse([head_x - head_r, head_y - head_r, head_x + head_r, head_y + head_r], fill=color)
    
    # Joints
    for pt in [(feet_x, feet_y), (hip_x, hip_y), (shoulder_x, shoulder_y), (elbow_x, elbow_y), (hand_x, hand_y)]:
        r = int(6 * scale)
        draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=joint_col, outline=CARD_BG, width=2)
        
    elbow_angle = int(160 - phase_progress * 75)
    return elbow_angle, (elbow_x, elbow_y)

# Video generator
output_path = "formfit_feature_walkthrough.mp4"
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, FPS, (WIDTH, HEIGHT))

print("Starting video synthesis...")

# Helper to write a PIL image to cv2 VideoWriter
def write_frame(img_pil):
    frame_bgr = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    out.write(frame_bgr)

# =========================================================================
# SCENE 1: Introduction & Architecture (0 to 6s = 180 frames)
# =========================================================================
for f in range(180):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "FormFit AI Movement Engine", "Next-Gen Intelligent Motion Coaching Platform")
    
    # Hero Card
    draw_rounded_rect(draw, (80, 120, WIDTH - 80, 620), radius=20, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    
    # Banner
    draw_rounded_rect(draw, (120, 160, WIDTH - 120, 270), radius=14, fill=(245, 243, 255))
    draw.text((150, 180), "Welcome to FormFit", font=font_huge_bold, fill=PRIMARY)
    draw.text((150, 225), "Real-time, edge-computed biomechanical pose coaching & repetition intelligence.", font=font_subtitle, fill=TEXT_MUTED)
    
    # Key Highlights / Pillars
    pillars = [
        ("1. Pure Client-Side Privacy", "Zero server video uploads. MediaPipe runs locally in your browser via WebAssembly.", (240, 253, 244), SECONDARY),
        ("2. Refined Movement Focus", "Dedicated biomechanical models for Basic Squats & Standard Pushups.", (238, 242, 255), ACCENT_BLUE),
        ("3. Scale-Free Live Coach", "Dynamic auto-calibration, cover-crop alignment & zero stale landmark guarantees.", (254, 243, 199), (217, 119, 6)),
        ("4. Reference Video Learning", "Upload reference video, extract gold-standard phases, and compare form in real-time.", (250, 232, 255), PRIMARY)
    ]
    
    card_w = (WIDTH - 240 - 60) // 2
    for i, (title, desc, bg, col) in enumerate(pillars):
        row = i // 2
        col_idx = i % 2
        x1 = 120 + col_idx * (card_w + 30)
        y1 = 300 + row * 145
        draw_rounded_rect(draw, (x1, y1, x1 + card_w, y1 + 125), radius=12, fill=bg)
        draw.text((x1 + 20, y1 + 22), title, font=font_bold, fill=col)
        draw.text((x1 + 20, y1 + 58), desc, font=font_body, fill=TEXT_MAIN)
        
    write_frame(img)

# =========================================================================
# SCENE 2: The Two Core Exercises (6s to 13s = 210 frames)
# =========================================================================
for f in range(210):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Curated Movement Catalog", "Precision Biomechanics for Core Functional Patterns")
    
    # Exercise 1: Basic Squats
    draw_rounded_rect(draw, (80, 120, 620, 640), radius=18, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw_rounded_rect(draw, (110, 145, 270, 178), radius=8, fill=(240, 253, 244))
    draw.text((125, 153), "LOWER BODY CORE", font=font_badge, fill=SECONDARY)
    draw.text((110, 190), "Basic Squats", font=font_huge_bold, fill=TEXT_MAIN)
    draw.text((110, 235), "Foundational bodyweight compound pattern.", font=font_body, fill=TEXT_MUTED)
    
    # Animated squat avatar inside card
    prog = (math.sin(f * 0.08) + 1.0) / 2.0
    ang, pt = draw_squat_figure(draw, cx=230, cy=440, scale=1.4, phase_progress=prog)
    
    # Specs on right side of card 1
    draw.text((370, 290), "Target Knee Flexion:", font=font_bold, fill=TEXT_MAIN)
    draw.text((370, 320), "80 deg - 95 deg (Parallel)", font=font_subtitle, fill=SECONDARY)
    draw.text((370, 370), "Key Tracking Points:", font=font_bold, fill=TEXT_MAIN)
    draw.text((370, 400), "* Hip Hinge Depth\n* Knee Valgus Cave\n* Chest & Torso Pitch\n* Ankle Mobility", font=font_body, fill=TEXT_MUTED)
    
    # Live angle readout
    draw_rounded_rect(draw, (370, 520, 580, 590), radius=10, fill=(243, 232, 255))
    draw.text((385, 532), f"Live Knee Angle: {ang} deg", font=font_bold, fill=PRIMARY)
    draw.text((385, 560), "Status: " + ("Deep Parallel" if prog > 0.8 else "Descending"), font=font_body, fill=TEXT_MUTED)
    
    # Exercise 2: Standard Pushups
    draw_rounded_rect(draw, (660, 120, WIDTH - 80, 640), radius=18, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw_rounded_rect(draw, (690, 145, 850, 178), radius=8, fill=(238, 242, 255))
    draw.text((705, 153), "UPPER BODY CHEST", font=font_badge, fill=ACCENT_BLUE)
    draw.text((690, 190), "Standard Pushups", font=font_huge_bold, fill=TEXT_MAIN)
    draw.text((690, 235), "Gold-standard pushing & anti-extension core.", font=font_body, fill=TEXT_MUTED)
    
    # Animated pushup avatar inside card
    p_prog = (math.sin(f * 0.08 + 1.5) + 1.0) / 2.0
    p_ang, p_pt = draw_pushup_figure(draw, cx=860, cy=430, scale=1.3, phase_progress=p_prog)
    
    draw.text((950, 290), "Target Elbow Flexion:", font=font_bold, fill=TEXT_MAIN)
    draw.text((950, 320), "85 deg - 90 deg (Full Deck)", font=font_subtitle, fill=ACCENT_BLUE)
    draw.text((950, 370), "Key Tracking Points:", font=font_bold, fill=TEXT_MAIN)
    draw.text((950, 400), "* Elbow Flare (45-60 deg)\n* Core Anti-Extension\n* Full Lockout at Top\n* Neutral Cervical Spine", font=font_body, fill=TEXT_MUTED)
    
    draw_rounded_rect(draw, (950, 520, 1160, 590), radius=10, fill=(238, 242, 255))
    draw.text((965, 532), f"Elbow Flexion: {p_ang} deg", font=font_bold, fill=ACCENT_BLUE)
    draw.text((965, 560), "Status: " + ("Full Depth" if p_prog > 0.8 else "Plank Hold"), font=font_body, fill=TEXT_MUTED)
    
    write_frame(img)

# =========================================================================
# SCENE 3: Live Coach Tracking & Computer Vision Engine (13s to 21s = 240 frames)
# =========================================================================
for f in range(240):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Universal Live Coach", "Real-Time 33-Point MediaPipe Computer Vision Engine")
    
    # Left: Simulated Camera Viewport with Object-Cover & Skeleton
    draw_rounded_rect(draw, (80, 115, 780, 650), radius=16, fill=DARK_PANEL, outline=BORDER_COLOR, width=2)
    
    # Camera HUD overlays
    draw_rounded_rect(draw, (100, 135, 230, 170), radius=6, fill=(0, 0, 0, 180), outline=(255, 255, 255), width=1)
    draw.text((115, 143), "LIVE WEBCAM", font=font_badge, fill=(239, 68, 68))
    
    fps_val = 30.0 + math.sin(f * 0.1) * 0.8
    draw.text((660, 143), f"FPS: {fps_val:.1f}", font=font_bold, fill=(34, 197, 94))
    
    # Animated live figure
    prog = (math.sin(f * 0.07) + 1.0) / 2.0
    ang, knee_pt = draw_squat_figure(draw, cx=430, cy=400, scale=2.1, phase_progress=prog)
    
    # Coordinate grid lines & bounding landmarks
    draw.line([(250, 600), (610, 600)], fill=(75, 85, 99), width=2) # floor line
    
    # Depth percentage bar in camera viewport
    draw_rounded_rect(draw, (110, 615, 750, 635), radius=4, fill=(51, 65, 85))
    fill_w = int(640 * prog)
    draw_rounded_rect(draw, (110, 615, 110 + fill_w, 635), radius=4, fill=(34, 197, 94) if prog > 0.8 else PRIMARY)
    draw.text((120, 592), f"Squat Depth: {int(prog * 100)}%", font=font_badge, fill=(255, 255, 255))
    
    # Right: Live Coach Telemetry & Engineering Highlights
    draw_rounded_rect(draw, (810, 115, WIDTH - 80, 650), radius=16, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((840, 140), "Engine Capabilities", font=font_title, fill=TEXT_MAIN)
    
    telemetry_items = [
        ("Cover-Crop Aspect Ratio Alignment", "Corrects coordinate warping across any camera resolution (16:9, 4:3, portrait)."),
        ("Zero Stale Landmarks", "Instant TRACKING_LOST state whenever frame is occluded. Zero false rep counts."),
        ("Scale-Free Body Normalization", "Calculates depth and angles normalized to torso height, independent of distance."),
        ("Smart Visibility Warning", "Prompts 'Step back so head to feet are visible' when key joints leave viewport.")
    ]
    
    for i, (title, desc) in enumerate(telemetry_items):
        y_pos = 195 + i * 105
        draw_rounded_rect(draw, (835, y_pos, WIDTH - 105, y_pos + 90), radius=10, fill=(248, 250, 252), outline=BORDER_COLOR)
        draw.ellipse([855, y_pos + 15, 875, y_pos + 35], fill=(240, 253, 244), outline=SECONDARY, width=2)
        draw.text((862, y_pos + 16), "v", font=font_badge, fill=SECONDARY)
        draw.text((890, y_pos + 15), title, font=font_bold, fill=PRIMARY)
        draw.text((890, y_pos + 42), desc, font=font_body, fill=TEXT_MUTED)
        
    write_frame(img)

# =========================================================================
# SCENE 4: Intelligent Rep Counting & State Machine (21s to 29s = 240 frames)
# =========================================================================
for f in range(240):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Intelligent Rep Counting", "Biomechanical Finite State Machine & Quality Ledger")
    
    # Top metrics row
    rep_count = 1 + (f // 80)
    cycle = (f % 80) / 80.0
    # Map cycle to movement
    prog = math.sin(cycle * math.pi)
    
    state_names = ["START / UPRIGHT", "DESCENDING", "PARALLEL BOTTOM", "ASCENDING", "COMPLETED"]
    if prog < 0.15:
        curr_state = state_names[0]
        state_col = (100, 116, 139)
    elif cycle < 0.5:
        curr_state = state_names[1] if prog < 0.8 else state_names[2]
        state_col = (234, 88, 12) if prog < 0.8 else SECONDARY
    else:
        curr_state = state_names[3] if prog > 0.2 else state_names[4]
        state_col = ACCENT_BLUE if prog > 0.2 else SECONDARY
        
    # Metric cards
    draw_rounded_rect(draw, (80, 115, 420, 230), radius=14, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((105, 130), "REPS COMPLETED", font=font_badge, fill=TEXT_MUTED)
    draw.text((105, 155), f"{rep_count}", font=font_huge_bold, fill=PRIMARY)
    draw.text((170, 175), "Clean Reps", font=font_bold, fill=SECONDARY)
    
    draw_rounded_rect(draw, (450, 115, 830, 230), radius=14, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((475, 130), "CURRENT STATE", font=font_badge, fill=TEXT_MUTED)
    draw.text((475, 160), curr_state, font=font_title, fill=state_col)
    
    draw_rounded_rect(draw, (860, 115, WIDTH - 80, 230), radius=14, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((885, 130), "FORM ACCURACY", font=font_badge, fill=TEXT_MUTED)
    draw.text((885, 155), "96%", font=font_huge_bold, fill=SECONDARY)
    draw.text((980, 175), "Optimal Depth", font=font_bold, fill=TEXT_MAIN)
    
    # Center Visualization: Split View
    # Left: Squat stick figure with angle callout
    draw_rounded_rect(draw, (80, 255, 620, 650), radius=16, fill=DARK_PANEL)
    ang, knee_pt = draw_squat_figure(draw, cx=350, cy=460, scale=1.9, phase_progress=prog)
    
    draw_rounded_rect(draw, (110, 280, 290, 320), radius=8, fill=(30, 41, 59))
    draw.text((125, 290), f"KNEE ANGLE: {ang} deg", font=font_bold, fill=(34, 197, 94) if ang < 95 else (255, 255, 255))
    
    # Right: The State Flowchart diagram
    draw_rounded_rect(draw, (650, 255, WIDTH - 80, 650), radius=16, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((680, 280), "State Transition Logic", font=font_title, fill=TEXT_MAIN)
    
    states_display = [
        ("1. START / READY", "User standing tall. Knee angle > 160 deg. Calibrating user dimensions."),
        ("2. DESCENDING", "Knee angle decreases < 140 deg. Velocity tracker engages."),
        ("3. IN_BOTTOM (GATE)", "Femur achieves parallel to floor (80-95 deg). Rep gate unlocks."),
        ("4. ASCENDING", "Upward drive initiated. Core stability and knee track monitored."),
        ("5. COMPLETED", "User returns to > 160 deg lockout. Rep incremented & logged.")
    ]
    
    for i, (st, desc) in enumerate(states_display):
        y_pos = 325 + i * 62
        is_active = (curr_state.split()[0] in st)
        bg = (243, 232, 255) if is_active else (248, 250, 252)
        border = PRIMARY if is_active else BORDER_COLOR
        draw_rounded_rect(draw, (680, y_pos, WIDTH - 110, y_pos + 52), radius=8, fill=bg, outline=border, width=2 if is_active else 1)
        draw.text((700, y_pos + 8), st, font=font_bold, fill=PRIMARY if is_active else TEXT_MAIN)
        draw.text((700, y_pos + 28), desc, font=font_body, fill=TEXT_MUTED)
        
    write_frame(img)

# =========================================================================
# SCENE 5: Reference Video Comparison & Ghost Overlay (29s to 37s = 240 frames)
# =========================================================================
for f in range(240):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Reference Video Learning", "Compare Live Form Against Any Master Performance")
    
    # Left: Dual Overlay Camera (Live User + Target Ghost)
    draw_rounded_rect(draw, (80, 115, 680, 650), radius=16, fill=DARK_PANEL)
    
    draw_rounded_rect(draw, (105, 135, 340, 170), radius=6, fill=(0, 0, 0, 180))
    draw.text((120, 143), "TARGET GHOST OVERLAY", font=font_badge, fill=(192, 132, 252))
    
    prog_user = (math.sin(f * 0.08) + 1.0) / 2.0
    prog_ref = (math.sin(f * 0.08 + 0.15) + 1.0) / 2.0
    
    # Draw reference ghost first (purple translucent silhouette)
    draw_squat_figure(draw, cx=380, cy=420, scale=1.9, phase_progress=prog_ref, is_ghost=True)
    # Draw live user skeleton on top (solid colors)
    draw_squat_figure(draw, cx=380, cy=420, scale=1.9, phase_progress=prog_user, is_ghost=False)
    
    # Legend overlay
    draw_rounded_rect(draw, (105, 590, 480, 630), radius=8, fill=(0, 0, 0, 190))
    draw.ellipse([120, 605, 134, 619], fill=GHOST_SKELETON)
    draw.text((145, 603), "Reference Standard", font=font_badge, fill=(255, 255, 255))
    draw.ellipse([290, 605, 304, 619], fill=SECONDARY)
    draw.text((315, 603), "Your Live Form", font=font_badge, fill=(255, 255, 255))
    
    # Right: How Reference Comparison Works
    draw_rounded_rect(draw, (710, 115, WIDTH - 80, 650), radius=16, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((740, 140), "Reference Workflow", font=font_title, fill=TEXT_MAIN)
    
    ref_steps = [
        ("1. Clip Upload & Auto-Extraction", "Upload any MP4 reference. MediaPipe extracts 33 joints across every frame."),
        ("2. Automatic Phase Segmentation", "Algorithms identify Start, Inflection (Bottom Depth), and Return phases."),
        ("3. Dynamic Time Warping (DTW)", "Matches user's live rep phase against reference standard, regardless of tempo."),
        ("4. Real-Time Tolerance Feedback", "Instant visual cues (Green / Amber / Red) when joint angles deviate > 12 deg.")
    ]
    
    for i, (title, desc) in enumerate(ref_steps):
        y_pos = 195 + i * 95
        draw_rounded_rect(draw, (740, y_pos, WIDTH - 110, y_pos + 82), radius=10, fill=(245, 243, 255), outline=(233, 213, 255))
        draw.text((760, y_pos + 14), title, font=font_bold, fill=PRIMARY)
        draw.text((760, y_pos + 42), desc, font=font_body, fill=TEXT_MAIN)
        
    # Bottom Callout
    draw_rounded_rect(draw, (740, 580, WIDTH - 110, 630), radius=8, fill=(240, 253, 244))
    draw.text((760, 595), "Supported for both Basic Squats & Standard Pushups", font=font_bold, fill=SECONDARY)
    
    write_frame(img)

# =========================================================================
# SCENE 6: Video Upload & Analytical Breakdown (37s to 45s = 240 frames)
# =========================================================================
for f in range(240):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Recorded Video Analysis", "Synchronized Frame Scrubbing, Biomechanical Table & Flaw Detection")
    
    # Main Dashboard Card
    draw_rounded_rect(draw, (80, 115, WIDTH - 80, 650), radius=16, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    
    # Side-by-side video previews inside card
    # Left Player: User clip
    draw_rounded_rect(draw, (110, 145, 520, 420), radius=10, fill=DARK_PANEL)
    draw.text((130, 160), "USER SUBMISSION (00:04.2)", font=font_badge, fill=(255, 255, 255))
    draw_squat_figure(draw, cx=315, cy=300, scale=1.1, phase_progress=0.75, knee_flaw=True)
    draw_rounded_rect(draw, (130, 370, 360, 400), radius=6, fill=(239, 68, 68, 200))
    draw.text((140, 377), "! Valgus Knee Collapse Detected", font=font_badge, fill=(255, 255, 255))
    
    # Right Player: Reference Gold Standard
    draw_rounded_rect(draw, (550, 145, 960, 420), radius=10, fill=DARK_PANEL)
    draw.text((570, 160), "GOLD STANDARD REFERENCE", font=font_badge, fill=(34, 197, 94))
    draw_squat_figure(draw, cx=755, cy=300, scale=1.1, phase_progress=0.95, knee_flaw=False)
    draw_rounded_rect(draw, (570, 370, 780, 400), radius=6, fill=(34, 197, 94, 200))
    draw.text((580, 377), "Optimal Alignment (88 deg)", font=font_badge, fill=(255, 255, 255))
    
    # Scrubber Bar below players
    draw_rounded_rect(draw, (110, 440, 960, 455), radius=5, fill=(226, 232, 240))
    scrub_pos = 110 + int(850 * ((f % 120) / 120.0))
    draw_rounded_rect(draw, (110, 440, scrub_pos, 455), radius=5, fill=PRIMARY)
    draw.ellipse([scrub_pos - 8, 439, scrub_pos + 8, 456], fill=PRIMARY, outline=(255, 255, 255), width=2)
    
    # Biomechanical Data Table at bottom
    draw_rounded_rect(draw, (110, 480, 960, 625), radius=10, fill=(248, 250, 252), outline=BORDER_COLOR)
    headers = ["Metric", "User Reading", "Target Range", "Evaluation"]
    col_x = [130, 340, 540, 750]
    for idx, h in enumerate(headers):
        draw.text((col_x[idx], 495), h, font=font_bold, fill=TEXT_MAIN)
        
    rows = [
        ("Knee Joint Angle", "102 deg", "80 deg - 95 deg", "Needs Deeper Depth (Amber)", WARNING),
        ("Knee / Hip Alignment", "Medial 4.2 cm", "< 1.5 cm deviation", "Knee Cave Flaw (Red)", (239, 68, 68)),
        ("Torso Pitch (Spine)", "42 deg incline", "38 deg - 48 deg", "Excellent Neutral Spine (Green)", SECONDARY)
    ]
    for r_idx, (m, u, t, ev, col) in enumerate(rows):
        y = 530 + r_idx * 30
        draw.text((col_x[0], y), m, font=font_body, fill=TEXT_MAIN)
        draw.text((col_x[1], y), u, font=font_body, fill=TEXT_MUTED)
        draw.text((col_x[2], y), t, font=font_body, fill=TEXT_MUTED)
        draw.text((col_x[3], y), ev, font=font_bold, fill=col)
        
    # Right Sidebar: AI Mistake Diagnosis
    draw_rounded_rect(draw, (990, 145, WIDTH - 110, 625), radius=12, fill=(254, 242, 242), outline=(254, 202, 202))
    draw.text((1010, 165), "AI Form Coaching", font=font_bold, fill=(185, 28, 28))
    draw.text((1010, 205), "Key Observations:\n\n1. Incomplete Depth:\nYou stopped 12 deg short of parallel.\n\n2. Knee Collapse:\nDrive knees outwards over toes during ascent.\n\n3. Torso Angle:\nGreat chest posture maintained throughout.", font=font_body, fill=TEXT_MAIN)
    
    write_frame(img)

# =========================================================================
# SCENE 7: Workout Summary & Progress History (45s to 52s = 210 frames)
# =========================================================================
for f in range(210):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Workout Summary & History", "Comprehensive Session Debrief & Long-Term Mastery Log")
    
    # Left Card: Session Scorecard
    draw_rounded_rect(draw, (80, 115, 540, 650), radius=16, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((115, 140), "Session Performance", font=font_title, fill=TEXT_MAIN)
    
    # Large Accuracy Gauge
    draw_rounded_rect(draw, (115, 190, 505, 300), radius=14, fill=(240, 253, 244), outline=(187, 247, 208))
    draw.text((140, 215), "94%", font=font_huge_bold, fill=SECONDARY)
    draw.text((260, 220), "Overall Form Mastery", font=font_bold, fill=TEXT_MAIN)
    draw.text((260, 250), "High fidelity alignment across 15 reps", font=font_body, fill=TEXT_MUTED)
    
    # Rep breakdown table
    stat_items = [
        ("Clean Reps", "12 reps", (240, 253, 244), SECONDARY),
        ("Form Adjustments", "2 reps", (254, 243, 199), (217, 119, 6)),
        ("Incomplete Reps", "1 rep", (254, 242, 242), (239, 68, 68)),
        ("Session Duration", "04m 32s", (243, 232, 255), PRIMARY)
    ]
    for idx, (label, val, bg, col) in enumerate(stat_items):
        y = 330 + idx * 72
        draw_rounded_rect(draw, (115, y, 505, y + 58), radius=10, fill=bg)
        draw.text((135, y + 17), label, font=font_bold, fill=TEXT_MAIN)
        draw.text((400, y + 17), val, font=font_bold, fill=col)
        
    # Right Card: Multi-Day Progress Rhythm
    draw_rounded_rect(draw, (570, 115, WIDTH - 80, 650), radius=16, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    draw.text((605, 140), "Daily Movement Rhythm", font=font_title, fill=TEXT_MAIN)
    draw.text((605, 175), "Local browser persistent history (zero privacy leaks)", font=font_body, fill=TEXT_MUTED)
    
    # Bar Chart of past 7 days
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    scores = [82, 86, 78, 91, 88, 95, 94]
    
    chart_bottom = 450
    chart_h = 180
    for d_idx, (day, sc) in enumerate(days):
        x = 630 + d_idx * 75
        bh = int((sc / 100.0) * chart_h)
        bar_top = chart_bottom - bh
        # Bar
        draw_rounded_rect(draw, (x, bar_top, x + 45, chart_bottom), radius=6, fill=PRIMARY if d_idx == 6 else (192, 132, 252))
        # Score label
        draw.text((x + 8, bar_top - 24), f"{sc}%", font=font_badge, fill=PRIMARY)
        # Day label
        draw.text((x + 6, chart_bottom + 12), day, font=font_bold, fill=TEXT_MAIN)
        
    # Baseline line
    draw.line([(610, chart_bottom), (WIDTH - 110, chart_bottom)], fill=BORDER_COLOR, width=2)
    
    # Coaching Insight Box
    draw_rounded_rect(draw, (605, 510, WIDTH - 110, 620), radius=12, fill=(248, 250, 252), outline=BORDER_COLOR)
    draw.text((625, 528), "Longitudinal Trend:", font=font_bold, fill=PRIMARY)
    draw.text((625, 555), "Knee stability during the bottom transition has improved by +16% over the last 7 sessions. Consistent depth achievement is now 92%.", font=font_body, fill=TEXT_MAIN)
    
    write_frame(img)

# =========================================================================
# SCENE 8: Live Deployment & GitHub Pages (52s to 58s = 180 frames)
# =========================================================================
for f in range(180):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Ready to Train Anywhere", "Open Source & Hosted Live on GitHub Pages")
    
    draw_rounded_rect(draw, (120, 140, WIDTH - 120, 620), radius=20, fill=CARD_BG, outline=BORDER_COLOR, width=2)
    
    draw.text((160, 180), "Live Deployment Information", font=font_huge_bold, fill=PRIMARY)
    draw.text((160, 230), "Accessible on desktop and mobile web browsers with zero installation.", font=font_subtitle, fill=TEXT_MUTED)
    
    links = [
        ("GitHub Repository:", "https://github.com/MDhanushraju/gym", ACCENT_BLUE),
        ("Live Web App (GitHub Pages):", "https://mdhanushraju.github.io/gym/", SECONDARY),
        ("Architecture Model:", "Pure React 18 + Vite + MediaPipe WASM + Tailwind CSS", PRIMARY),
        ("Privacy & Security:", "100% Client-Side In-Browser Execution. No Camera Feed Ever Transmitted.", TEXT_MAIN)
    ]
    
    for i, (label, val, col) in enumerate(links):
        y = 290 + i * 75
        draw_rounded_rect(draw, (160, y, WIDTH - 160, y + 60), radius=10, fill=(248, 250, 252), outline=BORDER_COLOR)
        draw.text((185, y + 18), label, font=font_bold, fill=TEXT_MAIN)
        draw.text((450, y + 18), val, font=font_bold, fill=col)
        
    write_frame(img)

# Release video writer
out.release()
print(f"Video successfully written to {output_path}")

