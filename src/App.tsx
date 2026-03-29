import { useState, useEffect, useCallback } from "react";
import EarlCanvas from "./components/EarlCanvas";
import SpeechBubble from "./components/SpeechBubble";
import Confetti from "./components/Confetti";
import SettingsPanel from "./components/SettingsPanel";
import AboutPanel from "./components/AboutPanel";
import { useEarlBehavior } from "./hooks/useEarlBehavior";
import { useBirthday } from "./hooks/useBirthday";
import { useDrag } from "./hooks/useDrag";
import { WINDOW_HEIGHT } from "./utils/constants";

function MainWindow() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const { isBirthday, name: birthdayName } = useBirthday();

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const earl = useEarlBehavior(isBirthday, birthdayName, screenWidth);

  const dragCallbacks = {
    onDragStart: earl.handleDragStart,
    onDragMove: earl.handleDragMove,
    onDragEnd: earl.handleDragEnd,
  };
  const { handleMouseDown } = useDrag(dragCallbacks);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.detail === 1) {
        earl.handleClick();
      }
    },
    [earl.handleClick]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  if (!earl.ready) return null;

  return (
    <div
      style={{
        width: "100%",
        height: WINDOW_HEIGHT,
        background: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isBirthday && (
        <Confetti
          active={isBirthday}
          burst={earl.confettiBurst}
          onBurstDone={earl.clearConfettiBurst}
          areaWidth={screenWidth}
          areaHeight={WINDOW_HEIGHT}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: earl.position.x,
          top: earl.position.y,
          cursor: "pointer",
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={earl.handleMouseEnter}
        onMouseLeave={earl.handleMouseLeave}
      >
        <SpeechBubble
          message={earl.speechMessage}
          onDone={earl.dismissSpeech}
          displaySize={earl.displaySize}
        />
        <EarlCanvas
          animatorState={earl.animatorState}
          displaySize={earl.displaySize}
          sleepBreathOffset={earl.sleepBreathOffset}
        />
      </div>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  if (view === "settings") return <SettingsPanel />;
  if (view === "about") return <AboutPanel />;
  return <MainWindow />;
}

export default App;
