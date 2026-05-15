#!/usr/bin/env python3
import argparse
from datetime import datetime
from pathlib import Path

def find_data_yaml(root: Path) -> Path:
    candidates = list(root.rglob("data.yaml"))
    if not candidates:
        raise FileNotFoundError(
            f"No data.yaml found under {root}. Provide --data to a valid dataset YAML."
        )
    candidates.sort(key=lambda p: len(p.parts))
    return candidates[0]

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a YOLOv11 model on the FireAware smoke/fire dataset."
    )
    parser.add_argument(
        "--size",
        choices=["n", "s", "m", "l", "x"],
        default="s",
        help="YOLOv11 model size (n, s, m, l, x).",
    )
    parser.add_argument("--epochs", type=int, default=100, help="Number of epochs.")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size.")
    parser.add_argument("--batch", type=int, default=16, help="Batch size.")
    parser.add_argument(
        "--device",
        type=str,
        default="",
        help="Device for training (e.g. 'cpu', '0', '0,1'). Empty=auto.",
    )
    parser.add_argument(
        "--data",
        type=str,
        default="",
        help="Path to data.yaml. Defaults to the local FireAware dataset.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(Path(__file__).resolve().parent / "runs"),
        help="Where to store training runs.",
    )
    parser.add_argument(
        "--run-name",
        type=str,
        default="",
        help="Custom run name (default auto timestamp).",
    )
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    dataset_dir = Path(__file__).resolve().parent / "FireAware-yolov11-smoke-fire-detection.yolov11"
    default_data_yaml = dataset_dir / "data.yaml"
    if args.data:
        data_yaml = Path(args.data)
    elif default_data_yaml.exists():
        data_yaml = default_data_yaml
    else:
        data_yaml = find_data_yaml(dataset_dir)

    from ultralytics import YOLO

    weights = f"yolo11{args.size}.pt"
    run_name = args.run_name or f"yolo11{args.size}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    device = args.device if args.device else None

    model = YOLO(weights)
    model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        project=args.output_dir,
        name=run_name,
    )

if __name__ == "__main__":
    main()
