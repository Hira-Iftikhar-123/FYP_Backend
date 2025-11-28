import torch
import torch.nn as nn

class ViolenceClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(112*112*3*16, 128),
            nn.ReLU(),
            nn.Linear(128, 3)   
        )

    def forward(self, x):
        return self.net(x)