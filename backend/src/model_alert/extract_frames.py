import os
import cv2
import numpy as np
import tempfile


def extract_frames(
    video_bytes,
    num_frames: int = 16,
    min_duration_s: float = 5.0,
    max_duration_s: float = 10.0,
):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    cap = None

    try:
        tmp.write(video_bytes)
        tmp.flush()
        tmp.close()

        cap = cv2.VideoCapture(tmp.name)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)

        if fps <= 0.0 or total <= 0:
            raise ValueError("Invalid clip: unable to determine FPS or frame count.")

        duration = total / fps
        if duration < min_duration_s or duration > max_duration_s:
            raise ValueError(
                f"Clip must be between {min_duration_s:.0f}s and "
                f"{max_duration_s:.0f}s (received {duration:.2f}s)."
            )

        frames_to_sample = min(num_frames, total)
        if frames_to_sample <= 0:
            raise ValueError("Clip does not contain enough frames.")

        idxs = np.linspace(0, total - 1, frames_to_sample).astype(int)
        frames = []

        for i in idxs:
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame)

        if not frames:
            raise ValueError("Unable to decode frames from the clip.")

        return np.array(frames), duration

    finally:
        if cap is not None:
            cap.release()
        tmp.close()
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


