import { Crown, Pencil, Sparkles, Trophy } from "lucide-react";

export function PlayerStrip({ room }) {
  return (
    <section className="players-strip" aria-label="玩家与积分">
      <header>
        <span>
          朋友们 <b>{room.players.length}/10</b>
        </span>
        <small>猜中 +2 · 画师 / 出题者 +1</small>
      </header>
      <div className="player-chips">
        {room.players.map((player) => {
          const drawer = player.id === room.round.drawerId,
            prompter = player.id === room.round.prompterId;
          const delta =
            room.round.status === "finished"
              ? room.round.scoreChanges?.[player.id]
              : 0;
          return (
            <div
              key={player.id}
              className={`player-chip ${player.id === room.me.id ? "player-self" : ""}`}
            >
              <span
                className={`player-avatar ${drawer || prompter ? "player-featured" : ""}`}
                aria-hidden="true"
              >
                {drawer ? (
                  <Pencil size={16} />
                ) : prompter ? (
                  <Sparkles size={16} />
                ) : (
                  player.id.slice(0, 1)
                )}
              </span>
              <div>
                <strong>
                  {player.id}
                  {player.id === room.me.id && <small>我</small>}
                </strong>
                <span>
                  {player.id === room.hostId && (
                    <Crown size={11} aria-label="房主" />
                  )}
                  {drawer ? "画师" : prompter ? "出题者" : "猜词伙伴"}
                </span>
              </div>
              <b className="player-score">
                {player.score}
                <small>分</small>
                {delta > 0 && <em>+{delta}</em>}
              </b>
            </div>
          );
        })}
      </div>
    </section>
  );
}
