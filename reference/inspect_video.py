"""Quick video inspection."""
import cv2, sys
cap = cv2.VideoCapture(r"c:\Users\91741\projects\gym\reference\squat_ref_1_side.mp4")
fps   = cap.get(cv2.CAP_PROP_FPS)
w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
dur   = total / fps if fps > 0 else 0
print(f"Resolution: {w}x{h}  FPS: {fps:.1f}  Frames: {total}  Duration: {dur:.2f}s")
print(f"Aspect ratio: {w/h:.3f}  Portrait: {h>w}")
cap.release()

