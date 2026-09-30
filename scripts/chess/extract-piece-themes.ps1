Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $PSScriptRoot '..\..\src\assets\chess\themes'

$csharp = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;

public static class ChessPieceExtractor
{
    private sealed class Piece
    {
        public string Name;
        public int MinX, MinY, MaxX, MaxY;
        public int RegionX, RegionY, RegionWidth, RegionHeight;
        public bool[] Keep;
        public int Width { get { return MaxX - MinX + 1; } }
        public int Height { get { return MaxY - MinY + 1; } }
    }

    public static void Run(string root)
    {
        Extract(root, "geometric", 1448, 1086, 575,
            new int[] { 0, 270, 510, 740, 990, 1220, 1448 }, true);
        Extract(root, "elegant", 1254, 1254, 646,
            new int[] { 0, 230, 435, 626, 851, 1050, 1254 }, true);
        Extract(root, "russian", 1254, 1254, 650,
            new int[] { 0, 232, 441, 625, 847, 1048, 1254 }, true);
        Extract(root, "jazz", 1448, 1086, 575,
            new int[] { 0, 280, 527, 750, 1015, 1245, 1448 }, false);
    }

    private static void Extract(string root, string theme, int expectedWidth,
        int expectedHeight, int rowBreak, int[] columns, bool removeSpeckles)
    {
        string directory = Path.Combine(root, theme);
        string sourcePath = Path.Combine(directory, "source.png");
        using (Bitmap source = new Bitmap(sourcePath))
        {
            if (source.Width != expectedWidth || source.Height != expectedHeight ||
                source.PixelFormat != PixelFormat.Format32bppArgb)
                throw new InvalidOperationException(theme + " source sheet changed; inspect before slicing.");

            byte[] pixels = ReadPixels(source);
            List<Piece> pieces = new List<Piece>();
            string[] kinds = { "K", "Q", "B", "N", "R", "P" };
            int[] rows = { 0, rowBreak, source.Height };
            for (int row = 0; row < 2; row++)
            {
                for (int col = 0; col < 6; col++)
                {
                    Piece piece = FindPiece(pixels, source.Width, columns[col], rows[row],
                        columns[col + 1] - columns[col], rows[row + 1] - rows[row],
                        removeSpeckles);
                    piece.Name = (row == 0 ? "w" : "b") + kinds[col];
                    pieces.Add(piece);
                }
            }

            int maxWidth = 0, maxHeight = 0;
            foreach (Piece piece in pieces)
            {
                maxWidth = Math.Max(maxWidth, piece.Width);
                maxHeight = Math.Max(maxHeight, piece.Height);
            }
            int canvasWidth = maxWidth + 16;
            int canvasHeight = maxHeight + 16;
            int baseline = canvasHeight - 9;
            foreach (Piece piece in pieces)
            {
                int left = (canvasWidth - piece.Width) / 2;
                int top = baseline - piece.Height + 1;
                byte[] output = new byte[canvasWidth * canvasHeight * 4];
                for (int y = piece.MinY; y <= piece.MaxY; y++)
                {
                    for (int x = piece.MinX; x <= piece.MaxX; x++)
                    {
                        if (!piece.Keep[(y - piece.RegionY) * piece.RegionWidth + x - piece.RegionX]) continue;
                        int original = (y * source.Width + x) * 4;
                        int destination = ((top + y - piece.MinY) * canvasWidth + left + x - piece.MinX) * 4;
                        Buffer.BlockCopy(pixels, original, output, destination, 4);
                    }
                }

                string path = Path.Combine(directory, piece.Name + ".png");
                using (Bitmap asset = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb))
                {
                    WritePixels(asset, output);
                    asset.Save(path, ImageFormat.Png);
                }
                using (Bitmap saved = new Bitmap(path))
                {
                    byte[] savedPixels = ReadPixels(saved);
                    for (int i = 0; i < output.Length; i++)
                        if (savedPixels[i] != output[i])
                            throw new InvalidOperationException(path + " differs from the source pixels.");
                }
                Console.WriteLine(theme + "/" + piece.Name + ".png <- (" + piece.MinX + "," + piece.MinY + ")-(" + piece.MaxX + "," + piece.MaxY + ")");
            }
            WritePreview(directory, pieces);
        }
    }

    private static void WritePreview(string directory, List<Piece> pieces)
    {
        using (Bitmap preview = new Bitmap(608, 320, PixelFormat.Format32bppArgb))
        using (Graphics graphics = Graphics.FromImage(preview))
        {
            graphics.Clear(Color.FromArgb(8, 17, 28));
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            foreach (int size in new int[] { 96, 48 })
            {
                int startY = size == 96 ? 16 : 224;
                for (int index = 0; index < pieces.Count; index++)
                {
                    int row = index / 6, col = index % 6;
                    int x = 16 + col * size, y = startY + row * size;
                    using (Brush square = new SolidBrush((row + col) % 2 == 0
                        ? Color.FromArgb(234, 215, 183) : Color.FromArgb(130, 88, 61)))
                        graphics.FillRectangle(square, x, y, size, size);
                    using (Bitmap asset = new Bitmap(Path.Combine(directory, pieces[index].Name + ".png")))
                    {
                        float scale = Math.Min(size * .91f / asset.Width, size * .91f / asset.Height);
                        float width = asset.Width * scale, height = asset.Height * scale;
                        graphics.DrawImage(asset, x + (size - width) / 2, y + (size - height) / 2,
                            width, height);
                    }
                }
            }
            preview.Save(Path.Combine(directory, "preview.png"), ImageFormat.Png);
        }
    }

    private static Piece FindPiece(byte[] pixels, int sourceWidth, int x0, int y0,
        int width, int height, bool removeSpeckles)
    {
        bool[] keep = new bool[width * height];
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                keep[y * width + x] = pixels[((y0 + y) * sourceWidth + x0 + x) * 4 + 3] > 0;

        if (removeSpeckles)
        {
            bool[] visited = new bool[keep.Length];
            List<int> largest = new List<int>();
            Queue<int> pending = new Queue<int>();
            for (int start = 0; start < keep.Length; start++)
            {
                if (!keep[start] || visited[start] ||
                    pixels[((y0 + start / width) * sourceWidth + x0 + start % width) * 4 + 3] < 24) continue;
                List<int> component = new List<int>();
                pending.Enqueue(start);
                visited[start] = true;
                while (pending.Count > 0)
                {
                    int current = pending.Dequeue();
                    component.Add(current);
                    int cx = current % width, cy = current / width;
                    for (int dy = -1; dy <= 1; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            int nx = cx + dx, ny = cy + dy;
                            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                            int next = ny * width + nx;
                            if (visited[next] || !keep[next] ||
                                pixels[((y0 + ny) * sourceWidth + x0 + nx) * 4 + 3] < 24) continue;
                            visited[next] = true;
                            pending.Enqueue(next);
                        }
                }
                if (component.Count > largest.Count) largest = component;
            }
            if (largest.Count == 0) throw new InvalidOperationException("No piece pixels found.");
            bool[] silhouette = new bool[keep.Length];
            foreach (int index in largest)
            {
                int cx = index % width, cy = index / width;
                for (int dy = -2; dy <= 2; dy++)
                    for (int dx = -2; dx <= 2; dx++)
                    {
                        int nx = cx + dx, ny = cy + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height)
                            silhouette[ny * width + nx] = true;
                    }
            }
            for (int i = 0; i < keep.Length; i++) keep[i] = keep[i] && silhouette[i];
        }

        Piece piece = new Piece { RegionX = x0, RegionY = y0, RegionWidth = width,
            RegionHeight = height, Keep = keep, MinX = sourceWidth, MinY = y0 + height,
            MaxX = -1, MaxY = -1 };
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                if (keep[y * width + x])
                {
                    piece.MinX = Math.Min(piece.MinX, x0 + x);
                    piece.MinY = Math.Min(piece.MinY, y0 + y);
                    piece.MaxX = Math.Max(piece.MaxX, x0 + x);
                    piece.MaxY = Math.Max(piece.MaxY, y0 + y);
                }
        if (piece.MaxX < piece.MinX) throw new InvalidOperationException("Missing chess piece.");
        return piece;
    }

    private static byte[] ReadPixels(Bitmap bitmap)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            if (data.Stride != bitmap.Width * 4) throw new InvalidOperationException("Unexpected PNG stride.");
            byte[] pixels = new byte[data.Stride * bitmap.Height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            return pixels;
        }
        finally { bitmap.UnlockBits(data); }
    }

    private static void WritePixels(Bitmap bitmap, byte[] pixels)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try { Marshal.Copy(pixels, 0, data.Scan0, pixels.Length); }
        finally { bitmap.UnlockBits(data); }
    }
}
'@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies System.Drawing
[ChessPieceExtractor]::Run((Resolve-Path $assetRoot).Path)
