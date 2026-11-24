"""
AcousticSpace - Audio Spectrogram Transformer (AST) Classifier (Module 2)
B.Tech Final-Year Project in AI & Data Science
Implements Patch Embedding, Multi-Head Self-Attention, and Binary Deepfake Classification
"""

import math
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

if TORCH_AVAILABLE:
    class PatchEmbed(nn.Module):
        """
        Splits 2D spectrogram (128 mel bins x 1024 time frames) into 16x16 patches
        and projects each patch to embedding dimension D (e.g. 768).
        """
        def __init__(self, img_size=(128, 1024), patch_size=(16, 16), in_chans=1, embed_dim=768):
            super().__init__()
            self.patch_size = patch_size
            self.num_patches = (img_size[0] // patch_size[0]) * (img_size[1] // patch_size[1])
            self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

        def forward(self, x):
            # x shape: (batch, 1, 128, 1024)
            x = self.proj(x)  # (batch, embed_dim, 8, 64)
            x = x.flatten(2).transpose(1, 2)  # (batch, num_patches, embed_dim)
            return x

    class ASTDeepfakeClassifier(nn.Module):
        """
        Audio Spectrogram Transformer classifier specialized for detecting forensic acoustic residuals
        and discriminating between authentic room reverberation and synthetic neural speech.
        """
        def __init__(self, num_classes=2, embed_dim=768, depth=12, num_heads=12, mlp_ratio=4.0):
            super().__init__()
            self.patch_embed = PatchEmbed(embed_dim=embed_dim)
            num_patches = self.patch_embed.num_patches

            # Class token & Learnable positional embeddings
            self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
            self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, embed_dim))
            self.pos_drop = nn.Dropout(p=0.1)

            # Transformer Encoder Blocks
            encoder_layer = nn.TransformerEncoderLayer(
                d_model=embed_dim,
                nhead=num_heads,
                dim_feedforward=int(embed_dim * mlp_ratio),
                dropout=0.1,
                activation='gelu',
                batch_first=True
            )
            self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=depth)

            self.norm = nn.LayerNorm(embed_dim)

            # Classification Head: 2 output classes (0: Real, 1: Deepfake)
            self.head = nn.Sequential(
                nn.Linear(embed_dim, 256),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(256, num_classes)
            )

        def forward(self, x):
            # Input: (batch, 1, 128, 1024)
            B = x.shape[0]
            x = self.patch_embed(x)

            # Prepend [CLS] token
            cls_tokens = self.cls_token.expand(B, -1, -1)
            x = torch.cat((cls_tokens, x), dim=1)

            # Add positional embeddings
            x = x + self.pos_embed
            x = self.pos_drop(x)

            # Transformer blocks
            x = self.transformer(x)
            x = self.norm(x)

            # Extract [CLS] token output
            cls_out = x[:, 0]
            logits = self.head(cls_out)
            return logits

else:
    class ASTDeepfakeClassifier:
        """Fallback definition when PyTorch is not yet installed."""
        def __init__(self, **kwargs):
            self.status = "PyTorch not found. Install PyTorch to instantiate neural AST model."
