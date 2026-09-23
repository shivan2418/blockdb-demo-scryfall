import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ManaCost } from "../components/ManaCost";
import { SymbolText } from "../components/ManaSymbol";
import {
  faces,
  imageUrls,
  legalities,
  prices,
  statLine,
  typeLine,
  type Card,
} from "../data/card-view";
import { getCard } from "../data/cards";

interface DetailState {
  status: "loading" | "ready" | "missing" | "error";
  card: Card | null;
  error: string | null;
}

function useCard(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({ status: "loading", card: null, error: null });

  useEffect(() => {
    if (!id) {
      setState({ status: "missing", card: null, error: null });
      return;
    }
    let active = true;
    setState({ status: "loading", card: null, error: null });

    void getCard(id)
      .then((card) => {
        if (!active) return;
        setState(
          card
            ? { status: "ready", card, error: null }
            : { status: "missing", card: null, error: null },
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          card: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  return state;
}

/** Oracle text arrives with literal newlines between paragraphs. */
function OracleText({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <div className="oracle">
      {text.split("\n").map((line, index) => (
        <p key={index}>
          <SymbolText text={line} />
        </p>
      ))}
    </div>
  );
}

function CardImages({ card }: { card: Card }) {
  const urls = imageUrls(card, "large");
  if (urls.length === 0) return <div className="detail-image tile-fallback">No image</div>;

  return (
    <div className="detail-images">
      {urls.map((url, index) => (
        <img key={url} src={url} alt={`${card.name} face ${index + 1}`} className="detail-image" />
      ))}
    </div>
  );
}

export function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const { status, card, error } = useCard(id);

  if (status === "loading") return <p className="notice">Loading card…</p>;
  if (status === "error") return <p className="error">{error}</p>;
  if (status === "missing" || !card) {
    return (
      <div className="detail-missing">
        <p className="empty">That card isn’t in this dataset.</p>
        <Link to="/" className="link-button">
          ← Back to browse
        </Link>
      </div>
    );
  }

  const cardFaces = faces(card);
  const formats = legalities(card);
  const priceList = prices(card);
  const stats = statLine(card);

  return (
    <article className="detail">
      <CardImages card={card} />

      <div className="detail-body">
        <header className="detail-head">
          <h1>{card.name}</h1>
          <ManaCost cost={card.mana_cost} />
        </header>

        <p className="detail-type">{typeLine(card)}</p>

        {/* Single-faced cards carry text at the top level; split/transforming cards per face. */}
        {cardFaces.length > 0 ? (
          <div className="faces">
            {cardFaces.map((face, index) => (
              <section key={index} className="face">
                <h2>
                  {face.name} <ManaCost cost={face.mana_cost} />
                </h2>
                <p className="detail-type">{face.type_line}</p>
                <OracleText text={face.oracle_text} />
                {face.flavor_text && <p className="flavor">{face.flavor_text}</p>}
                {(face.power || face.loyalty) && (
                  <p className="stats">
                    {face.power ? `${face.power}/${face.toughness ?? ""}` : `Loyalty ${face.loyalty}`}
                  </p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <>
            <OracleText text={card.oracle_text} />
            {card.flavor_text && <p className="flavor">{card.flavor_text}</p>}
            {stats && <p className="stats">{stats}</p>}
          </>
        )}

        <dl className="facts">
          <div>
            <dt>Set</dt>
            <dd>
              {card.set_name} ({card.set?.toUpperCase()}) · #{card.collector_number}
            </dd>
          </div>
          <div>
            <dt>Rarity</dt>
            <dd className="capitalize">{card.rarity}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{card.released_at}</dd>
          </div>
          <div>
            <dt>Artist</dt>
            <dd>{card.artist}</dd>
          </div>
          {card.edhrec_rank ? (
            <div>
              <dt>EDHREC rank</dt>
              <dd>#{card.edhrec_rank.toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>

        {priceList.length > 0 && (
          <section className="prices">
            <h2>Prices</h2>
            <ul>
              {priceList.map((price) => (
                <li key={price.label}>
                  <span>{price.label}</span>
                  <strong>{price.value}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        {formats.length > 0 && (
          <section className="legalities">
            <h2>Legality</h2>
            <ul>
              {formats.map((entry) => (
                <li key={entry.format} className={`legal-${entry.status}`}>
                  <span className="capitalize">{entry.format}</span>
                  <em>{entry.status.replace(/_/g, " ")}</em>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="detail-links">
          <Link to="/" className="link-button">
            ← Back to browse
          </Link>
          {card.scryfall_uri && (
            <a href={card.scryfall_uri} target="_blank" rel="noreferrer" className="link-button">
              View on Scryfall ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
