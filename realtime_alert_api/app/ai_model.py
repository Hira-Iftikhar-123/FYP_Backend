from pathlib import Path
from typing import Tuple

import torch

CLASS_LABELS = ["normal", "theft", "violence"]


def load_inference_model() -> torch.nn.Module:
    """
    Load the trained PyTorch model for inference.

    This is a placeholder implementation. Replace the architecture and path
    with the actual model used in production.
    """
    model_path = Path("model.pth")
    model = torch.nn.Linear(1, len(CLASS_LABELS))
    if model_path.exists():
        state_dict = torch.load(model_path, map_location="cpu")
        model.load_state_dict(state_dict)
    model.eval()
    return model


def run_inference(input_tensor: torch.Tensor, model: torch.nn.Module) -> Tuple[str, float]:
    """
    Run inference on the given input tensor.

    The implementation here is a placeholder. Replace this with the correct
    preprocessing and forward pass required by the real model.
    """
    with torch.no_grad():
        logits = model(input_tensor)
        probs = torch.softmax(logits, dim=-1)
        confidence, idx = torch.max(probs, dim=-1)

    label = CLASS_LABELS[int(idx.item())]
    return label, float(confidence.item())


