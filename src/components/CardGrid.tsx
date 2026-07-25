import { Link } from "react-router-dom";
import { primaryImage, type Card } from "../data/card-view";
import { useInView } from "../hooks/useInView";

function CardTile({ card }: { card: Card }) {
  const image = primaryImage(card, "normal");
  const { ref, inView } = useInView<HTMLAnchorElement>();

  return (
    <Link ref={ref} to={`/card/${card.id}`} className="tile" title={card.name}>
      {/* The shell reserves the card's aspect ratio so nothing shifts when the
          image arrives, and the src stays unset until the tile is in view. */}
      <div className="tile-shell">
        {image && inView && <img src={image} alt={card.name} loading="lazy" />}
        {!image && (
          <div className="tile-fallback">
            <span>{card.name}</span>
          </div>
        )}
      </div>
      <span className="tile-caption">
        {card.name}
        <small>
          {card.set?.toUpperCase()} · {card.rarity}
        </small>
      </span>
    </Link>
  );
}

export function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="tile-shell skeleton" />
      ))}
    </div>
  );
}
