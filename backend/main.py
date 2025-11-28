from fastapi import FastAPI, UploadFile, File, HTTPException
import torch
import torch.nn.functional as F
import json
from model.swin_model import ViolenceSwin3D
from utils.extract_frames import extract_frames

app = FastAPI()

# -------------------------------
# LOAD CLASSES
# -------------------------------
CLASSES = json.load(open("model/classes.json"))

# -------------------------------
# LOAD MODEL
# -------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"

model = ViolenceSwin3D(num_classes=len(CLASSES)).to(device)
model.load_state_dict(torch.load("model/swin_model.pth", map_location=device))
model.eval()

# -------------------------------
# DETECTION ENDPOINT
# -------------------------------
@app.post("/detect")
async def detect(video: UploadFile = File(...)):
    video_bytes = await video.read()

    try:
        # Extract frames from a 5-10s clip
        frames, duration = extract_frames(
            video_bytes,
            num_frames=16,
            min_duration_s=5.0,
            max_duration_s=10.0,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    frames = torch.tensor(frames, dtype=torch.float32)
    frames = frames.permute(0, 3, 1, 2)   # (T,C,H,W)
    frames = frames / 255.0

    # reshape → (1,3,T,H,W)
    frames = frames.unsqueeze(0)
    frames = frames.permute(0, 2, 1, 3, 4)

    _, C, T, H, W = frames.shape

    # Resize spatial dimensions to 224×224 while keeping the clip length
    frames = torch.nn.functional.interpolate(
        frames,
        size=(T, 224, 224),
        mode="trilinear",
        align_corners=False
    )

    frames = frames.to(device)

    # -------------------------------
    # INFERENCE
    # -------------------------------
    with torch.no_grad():
        if device == "cuda":
            with torch.amp.autocast(device_type="cuda"):
                logits = model(frames)
        else:
            logits = model(frames)

        probs = F.softmax(logits, dim=1)
        conf, pred = torch.max(probs, dim=1)

    return {
        "prediction": CLASSES[pred.item()],
        "confidence": float(conf.item()),
        "clip_duration_seconds": round(float(duration), 2),
    }
