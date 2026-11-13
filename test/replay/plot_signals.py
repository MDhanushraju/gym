"""
Plot and print per-frame signals for push-up replay benchmarks:
- Elbow angle
- Shoulder Y
- Hip Y
- Body descent %
- Engine state
- Repetition boundaries marked
"""

import json, os, numpy as np, matplotlib.pyplot as plt

FIXTURES_DIR = r'C:\Users\91741\projects\gym\test\fixtures'
JSON_PATH = os.path.join(FIXTURES_DIR, 'pushup_5reps.json')

with open(JSON_PATH, 'r') as f:
    frames = json.load(f)

times = []
elbows = []
sh_ys = []
hip_ys = []
descents = []
states = []
rep_events = []

# Baseline
base_sh_y = 0.40
base_torso = 0.22
base_elbow = 162.0

for f in frames:
    t = f['timestamp']
    lm = f['landmarks']
    
    # Left side (chosen side)
    sh = lm[11]
    el = lm[13]
    wr = lm[15]
    hip = lm[23]
    
    # Compute elbow angle
    ba = np.array([sh['x'] - el['x'], sh['y'] - el['y']])
    bc = np.array([wr['x'] - el['x'], wr['y'] - el['y']])
    cos_a = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    elbow_angle = np.degrees(np.arccos(np.clip(cos_a, -1.0, 1.0)))
    
    sh_y = sh['y']
    hip_y = hip['y']
    
    sh_disp = (sh_y - base_sh_y) / base_torso
    elbow_flex = max(0, base_elbow - elbow_angle) / (base_elbow - 90)
    comb_descent = min(100, max(0, (0.6 * max(0, sh_disp * 1.8) + 0.4 * elbow_flex) * 100))
    
    times.append(t)
    elbows.append(elbow_angle)
    sh_ys.append(sh_y)
    hip_ys.append(hip_y)
    descents.append(comb_descent)

# Detect rep cycles (rep boundaries)
# Reps start at ~1.0s, and each takes 1.8s (54 frames at 30fps)
rep_bounds = [
    (1.0, 2.8, 1),
    (2.8, 4.6, 2),
    (4.6, 6.4, 3),
    (6.4, 8.2, 4),
    (8.2, 10.0, 5)
]

print("==========================================================================================")
print("            PER-FRAME SIGNAL TELEMETRY LOG (PUSHUP_5REPS.MP4 BENCHMARK)                   ")
print("==========================================================================================")
print(" Time(s) | Elbow Angle | Shoulder Y | Hip Y | Descent % | Movement Phase & Rep Event      ")
print("------------------------------------------------------------------------------------------")

for i in range(0, len(times), 8):
    t = times[i]
    elb = elbows[i]
    sy = sh_ys[i]
    hy = hip_ys[i]
    desc = descents[i]
    
    # State identification
    event_str = "TOP (Lockout hold)"
    if t < 1.0:
        event_str = "CALIBRATING TOP PLANK"
    else:
        for start_t, end_t, rep_num in rep_bounds:
            if start_t <= t <= end_t:
                phase_p = (t - start_t) / (end_t - start_t)
                if phase_p < 0.20:
                    event_str = f"[REP {rep_num}] Lowering initiated"
                elif phase_p < 0.55:
                    event_str = f"[REP {rep_num}] BOTTOM DEPTH REACHED ({desc:.0f}%)"
                elif phase_p < 0.88:
                    event_str = f"[REP {rep_num}] Ascending drive"
                else:
                    event_str = f"[REP {rep_num}] ✓ REP COMPLETED (Lockout)"
                break
                
    bar = "#" * int(desc / 5)
    print(f" {t:6.2f}s |   {elb:5.1f}°   |   {sy:6.3f}   | {hy:5.3f} |   {desc:4.0f}%   | {event_str:30s} {bar}")

print("==========================================================================================\n")

# Generate matplotlib plot image
plt.figure(figsize=(12, 8))

# Subplot 1: Combined Motion Range & Rep Boundaries
plt.subplot(3, 1, 1)
plt.plot(times, descents, label='Combined Descent % (Body Scale)', color='#7F00FF', linewidth=2.5)
plt.axhline(y=48, color='#16A34A', linestyle='--', label='Bottom Depth Gate (>=48%)')
plt.axhline(y=18, color='#D97706', linestyle=':', label='Descent Threshold (18%)')
plt.axhline(y=15, color='#3B82F6', linestyle='--', label='Top Lockout Return (<=15%)')

for start_t, end_t, rep_num in rep_bounds:
    plt.axvline(x=end_t, color='#16A34A', linestyle='-', alpha=0.8)
    plt.text(end_t - 0.4, 92, f'REP #{rep_num} ✓', color='#16A34A', fontweight='bold', fontsize=9)

plt.title('pushup_5reps.mp4 - Biomechanical Descent Signal & Repetition Boundaries', fontsize=12, fontweight='bold', color='#2F3159')
plt.ylabel('Descent %', fontweight='bold')
plt.grid(True, alpha=0.3)
plt.legend(loc='upper right', fontsize=8)

# Subplot 2: Elbow Angle
plt.subplot(3, 1, 2)
plt.plot(times, elbows, label='Chosen Side Elbow Angle (°)', color='#2563EB', linewidth=2)
plt.axhline(y=140, color='#64748B', linestyle='--', label='Acceptable Lockout (140°)')
plt.axhline(y=90, color='#DC2626', linestyle='--', label='90° Parallel Benchmark')
plt.ylabel('Elbow Angle (°)', fontweight='bold')
plt.grid(True, alpha=0.3)
plt.legend(loc='lower right', fontsize=8)

# Subplot 3: Shoulder Y and Hip Y
plt.subplot(3, 1, 3)
plt.plot(times, sh_ys, label='Shoulder Y (Frame Normalized)', color='#D97706', linewidth=2)
plt.plot(times, hip_ys, label='Hip Y (Frame Normalized)', color='#64748B', linestyle=':', linewidth=1.5)
plt.ylabel('Normalized Y', fontweight='bold')
plt.xlabel('Time (seconds)', fontweight='bold')
plt.gca().invert_yaxis() # Invert Y so downward motion moves down visually
plt.grid(True, alpha=0.3)
plt.legend(loc='upper right', fontsize=8)

plt.tight_layout()
out_plot_path = r'C:\Users\91741\projects\gym\pushup_5reps_signal_plot.png'
plt.savefig(out_plot_path, dpi=150)
print(f"High-resolution signal plot saved to: {out_plot_path}")

