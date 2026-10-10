import { useEffect, useRef, type RefObject } from "react";

type Position = "north" | "west" | "east" | "south";
type Scene = "garden" | "beach" | "bar" | "mountain";
type Nameplate = { name: string; role: "Spieler" | "Gegenspieler" | null; glow?: boolean };
const scenes: Record<Scene, { src: string; plates: Record<Position, [number, number]> }> = {
  garden: { src: "/images/schafkopf-garden-first-person.png", plates: { north: [832, 302], west: [305, 608], east: [1360, 608], south: [832, 805] } },
  beach: { src: "/images/schafkopf-beach-first-person.png", plates: { north: [832, 302], west: [305, 608], east: [1360, 608], south: [832, 805] } },
  bar: { src: "/images/schafkopf-bar-stools-empty.png", plates: { north: [832, 302], west: [305, 608], east: [1360, 608], south: [832, 805] } },
  mountain: { src: "/images/schafkopf-mountain-balcony.png", plates: { north: [832, 302], west: [305, 608], east: [1360, 608], south: [832, 805] } },
};

export default function SchafkopfNameplates({ scene, labels, knocked, spritzed, cardCounts, pageRef }: { scene: Scene; labels: Record<Position, Nameplate>; knocked: Record<Position, boolean>; spritzed: Record<Position, boolean>; cardCounts: Record<Position, number>; pageRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayKey = JSON.stringify({ labels, knocked, spritzed, cardCounts });
  useEffect(() => {
    const { labels, knocked, spritzed } = JSON.parse(overlayKey) as { labels: Record<Position, Nameplate>; knocked: Record<Position, boolean>; spritzed: Record<Position, boolean> };
    const page = pageRef.current;
    const canvas = canvasRef.current;
    if (!page || !canvas) return;
    const image = new Image();
    let cancelled = false;
    const draw = () => {
      if (cancelled || !image.naturalWidth) return;
      const width = page.clientWidth;
      const height = page.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const offsetX = (width - image.naturalWidth * scale) / 2;
      const offsetY = (height - image.naturalHeight * scale) / 2;
      const pageRect = page.getBoundingClientRect();
      const narrow = width < 700 || window.innerHeight <= 600 && window.matchMedia("(orientation: landscape)").matches;
      const shortViewport = narrow && window.innerHeight <= 600;
      const stage = page.querySelector<HTMLElement>(".sk-game-stage");
      const stageRect = stage?.getBoundingClientRect();
      for (const position of ["north", "west", "east", "south"] as const) {
        if (shortViewport && position === "south") continue;
        const [sourceX, sourceY] = scenes[scene].plates[position];
        const naturalX = sourceX * scale + offsetX;
        const plateWidth = shortViewport ? Math.min(82, width * .2) : narrow ? Math.min(104, width * .25) : Math.min(202, 222 * scale);
        const plateHeight = shortViewport ? 24 : narrow ? 35 : 46;
        const avatar = page.querySelector<HTMLElement>(`.sk-avatar-${position}`);
        const avatarRect = avatar?.getBoundingClientRect();
        const seatX = avatarRect ? avatarRect.left - pageRect.left + avatarRect.width / 2 : narrow && position === "west" ? width * .16 : narrow && position === "east" ? width * .84 : Math.max(42, Math.min(width - 42, naturalX));
        const stageLeft = stageRect ? stageRect.left - pageRect.left : 0;
        const stageRight = stageRect ? stageRect.right - pageRect.left : width;
        const x = Math.max(stageLeft + plateWidth / 2 + 6, Math.min(stageRight - plateWidth / 2 - 6, seatX));
        // Avatars fade out over their lower half. The nameplate follows the
        // lower of the visible portrait and its held cards, regardless of role.
        const portraitBottom = avatarRect ? avatarRect.top + avatarRect.height * .53 : 0;
        const cardsBottom = avatar ? [...avatar.querySelectorAll<HTMLElement>(".sk-card-back")].reduce((bottom, card) => Math.max(bottom, card.getBoundingClientRect().bottom), 0) : 0;
        const attachmentBottom = Math.max(portraitBottom, cardsBottom);
        const westLabelDrop = position === "west" ? narrow ? 31 : Math.min(59, Math.max(42, width * .045)) : 0;
        const backgroundY = sourceY * scale + offsetY + (position === "south" ? 0 : height * .055);
        const mobileSouthY = stageRect ? stageRect.bottom - pageRect.top - plateHeight / 2 - 3 : backgroundY;
        const seatY = (avatarRect ? attachmentBottom - pageRect.top + plateHeight / 2 + 2 : narrow && position === "south" ? mobileSouthY : backgroundY) + westLabelDrop;
        const y = stageRect ? Math.min(stageRect.bottom - pageRect.top - plateHeight / 2 - 6, seatY) : seatY;
        ctx.save();
        ctx.translate(x, y);
        ctx.transform(1, 0, -0.08, .78, 0, 0);
        ctx.shadowColor = "#130b08aa";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#4d2818";
        ctx.beginPath();
        ctx.roundRect(-plateWidth / 2, -plateHeight / 2 + 4, plateWidth, plateHeight, 5);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        const wood = ctx.createLinearGradient(0, -plateHeight / 2, 0, plateHeight / 2);
        wood.addColorStop(0, scene === "bar" ? "#a87848" : "#c38a58");
        wood.addColorStop(.48, scene === "bar" ? "#906039" : "#ae7447");
        wood.addColorStop(1, "#6c3e24");
        ctx.fillStyle = wood;
        ctx.beginPath();
        ctx.roundRect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight - 4, 5);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "#572e1b44";
        ctx.lineWidth = 1;
        for (let line = -plateHeight / 2 + 4; line < plateHeight / 2; line += 5) {
          ctx.beginPath();
          ctx.moveTo(-plateWidth / 2, line);
          ctx.bezierCurveTo(-plateWidth / 5, line + 2, plateWidth / 5, line - 2, plateWidth / 2, line + 1);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = "#f7d29a88";
        ctx.lineWidth = 1;
        ctx.strokeRect(-plateWidth / 2 + 3, -plateHeight / 2 + 3, plateWidth - 6, plateHeight - 10);
        const label = labels[position]?.name || "Spieler";
        const role = labels[position]?.role;
        if (role && labels[position]?.glow) {
          ctx.save();
          ctx.shadowColor = role === "Spieler" ? "#48f18a" : "#ff615d";
          ctx.shadowBlur = narrow ? 14 : 21;
          ctx.strokeStyle = role === "Spieler" ? "#48f18acc" : "#ff615dcc";
          ctx.lineWidth = narrow ? 2 : 3;
          ctx.strokeRect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight - 4);
          ctx.restore();
        }
        let fontSize = shortViewport ? 11 : narrow ? 14 : 19;
        do { ctx.font = `bold ${fontSize}px Georgia, serif`; fontSize -= 1; } while (ctx.measureText(label).width > plateWidth - 16 && fontSize > 10);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#edd0a088";
        ctx.fillText(label, 1, role ? -4 : 2);
        ctx.fillStyle = "#2b160d";
        if (role && labels[position]?.glow) {
          ctx.shadowColor = role === "Spieler" ? "#36ec78" : "#ff4b4b";
          ctx.shadowBlur = narrow ? 8 : 13;
        }
        ctx.fillText(label, 0, role ? -6 : 0);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        if (role) {
          ctx.font = `bold ${shortViewport ? 7 : narrow ? 9 : 11}px Georgia, serif`;
          ctx.fillStyle = role === "Spieler" ? "#f9df9b" : "#d8e9ef";
          ctx.fillText(role, 0, narrow ? 9 : 11);
        }
        if (knocked[position]) {
          const coinRadius = shortViewport ? 8 : narrow ? 12 : 15;
          ctx.save();
          ctx.translate(plateWidth / 2 + coinRadius * .9, 0);
          ctx.fillStyle = "#f5c85b";
          ctx.beginPath();
          ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#8a5a11";
          ctx.stroke();
          ctx.font = `bold ${shortViewport ? 6 : narrow ? 8 : 10}px Georgia, serif`;
          ctx.fillStyle = "#4a2a05";
          ctx.fillText("1 €", 0, 1);
          ctx.restore();
        }
        if (spritzed[position]) {
          const coinRadius = shortViewport ? 8 : narrow ? 12 : 15;
          const coinOffset = knocked[position] ? coinRadius * 2 + 5 : 0;
          ctx.save();
          ctx.translate(plateWidth / 2 + coinRadius * .9 + coinOffset, 0);
          ctx.fillStyle = "#9ed2ff";
          ctx.beginPath();
          ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#185b91";
          ctx.stroke();
          ctx.font = `bold ${shortViewport ? 6 : narrow ? 8 : 10}px Georgia, serif`;
          ctx.fillStyle = "#103d63";
          ctx.fillText("×2", 0, 1);
          ctx.restore();
        }
        ctx.restore();

        // The won-trick button belongs to the same seat group. Its DOM lives
        // on the table for interaction, so align it to this rendered plate.
        const trickStack = page.querySelector<HTMLElement>(`.sk-trick-stack-${position}`);
        const stackParent = trickStack?.offsetParent instanceof HTMLElement ? trickStack.offsetParent : null;
        if (trickStack && stackParent) {
          const parentRect = stackParent.getBoundingClientRect();
          const stackRect = trickStack.getBoundingClientRect();
          const stackX = Math.min(stageRight - stackRect.width - 12, x + plateWidth / 2 + 10);
          trickStack.style.left = `${pageRect.left + stackX - parentRect.left}px`;
          trickStack.style.top = `${pageRect.top + y - stackRect.height / 2 - parentRect.top}px`;
          trickStack.style.right = "auto";
        }
      }
    };
    image.addEventListener("load", draw);
    image.src = scenes[scene].src;
    if (image.complete) draw();
    const observer = new ResizeObserver(draw);
    observer.observe(page);
    const stage = page.querySelector<HTMLElement>(".sk-game-stage");
    if (stage) observer.observe(stage);
    return () => { cancelled = true; image.removeEventListener("load", draw); observer.disconnect(); };
  }, [scene, overlayKey, pageRef]);
  return <canvas ref={canvasRef} className="sk-scene-nameplates" aria-hidden="true" />;
}
