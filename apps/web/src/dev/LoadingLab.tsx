// /dev/loading: the loading screen on its own (for screenshots)
import "../odyssey/ui/game.css";
import GameLoading from "../odyssey/ui/Loading";

export default function LoadingLab() {
  return (
    <div className="od-app">
      <GameLoading label="Preparing your discovery…" />
    </div>
  );
}
