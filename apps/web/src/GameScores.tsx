import type { GameTotals, GameId } from '../../../packages/protocol/src/index.js';
import { gameDefinitions } from '../../../packages/games/src/catalogue.js';
export function ScoreTable({ rows }: {
    rows: (GameTotals & {
        id: string;
        name: string;
        isYou?: boolean;
    })[];
}) {
    return rows.length ? <div className="game-score-scroll"><table className="game-scores"><caption className="sr-only">Game scores</caption><thead><tr><th scope="col">Player</th><th scope="col" aria-label="Wins">W</th><th scope="col" aria-label="Draws">D</th><th scope="col" aria-label="Losses">L</th><th scope="col">Points</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}{row.isYou && <small> you</small>}</th><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td><b>{row.points}</b></td></tr>)}</tbody></table></div> : <p className="game-help">Scores appear when signed-in players finish a match.</p>;
}
export function PersonalGameScores({ scores }: {
    scores?: Partial<Record<GameId, GameTotals>>;
}) {
    const played = Object.entries(scores || {}).filter(([id, score]) => Object.hasOwn(gameDefinitions,id)&&score.played > 0);
    return <section className="personal-game-scores"><p className="eyebrow">YOUR PLAYING HISTORY</p><h2>My game scores.</h2>{played.length ? played.map(([id, score]) => <div key={id}><h3>{gameDefinitions[id as GameId]?.name || id}</h3><ScoreTable rows={[{ ...score, id: 'self', name: 'You' }]}/><p className="game-help">{score.played} games · {score.forfeits} forfeits. Saved across your rooms.</p></div>) : <p className="game-help">Play a match while signed in to start your personal record.</p>}</section>;
}
