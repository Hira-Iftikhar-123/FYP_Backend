import torch
import torch.nn as nn
from torchvision.models.video import swin3d_t, Swin3D_T_Weights


class ViolenceSwin3D(nn.Module):
    def __init__(self, num_classes: int = 6): 
        super().__init__()
        weights = Swin3D_T_Weights.KINETICS400_V1
        model = swin3d_t(weights=weights)

        in_features = model.head.in_features
        model.head = nn.Linear(in_features, num_classes)
        self.patch_embed = model.patch_embed
        self.features = model.features
        self.norm = model.norm
        self.head = model.head
        self.avgpool = model.avgpool

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.patch_embed(x)
        x = self.features(x)
        x = self.norm(x)
        x = x.permute(0, 4, 1, 2, 3)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.head(x)
        return x