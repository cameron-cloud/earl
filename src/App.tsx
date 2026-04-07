import { useState, useEffect, useCallback, useRef } from "react";
import EarlCanvas from "./components/EarlCanvas";
import SpeechBubble from "./components/SpeechBubble";
import Confetti from "./components/Confetti";
import SettingsPanel from "./components/SettingsPanel";
import AboutPanel from "./components/AboutPanel";
import { useEarlBehavior } from "./hooks/useEarlBehavior";
import { useBirthday } from "./hooks/useBirthday";
import { useDrag } from "./hooks/useDrag";
import PetHeart from "./components/PetHeart";
import { showWindow } from "./utils/config";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { checkForUpdates } from "./utils/updater";

function MainWindow() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);
  const { isBirthday, name: birthdayName } = useBirthday();

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
      setScreenHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const earl = useEarlBehavior(isBirthday, birthdayName, screenWidth, screenHeight);

  // Show window once sprites are loaded and Earl is ready to render
  const shownRef = useRef(false);
  useEffect(() => {
    if (earl.ready && !shownRef.current) {
      shownRef.current = true;
      showWindow().catch(() => {});
      checkForUpdates();
    }
  }, [earl.ready]);

  const dragCallbacks = {
    onDragStart: earl.handleDragStart,
    onDragMove: earl.handleDragMove,
    onDragEnd: earl.handleDragEnd,
  };
  const { handlePointerDown, didDrag } = useDrag(dragCallbacks);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDrag.current) return; // Was a drag, not a click
      if (e.detail === 1) {
        earl.handleClick();
      }
    },
    [earl.handleClick, didDrag]
  );

  const [petCount, setPetCount] = useState(0);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const petted = earl.handlePet();
    if (petted) setPetCount((c) => c + 1);
  }, [earl.handlePet]);

  if (!earl.ready) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
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
          areaHeight={screenHeight}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: earl.position.x,
          top: earl.position.y,
          cursor: "pointer",
        }}
        onPointerDown={handlePointerDown}
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
        <PetHeart trigger={petCount} displaySize={earl.displaySize} />
        <EarlCanvas
          animatorState={earl.animatorState}
          displaySize={earl.displaySize}
          sleepBreathOffset={earl.sleepBreathOffset}
          swingAngle={earl.swingAngle}
        />
      </div>
    </div>
  );
}

function App() {
  // Route by window label — Rust sets "settings" or "about" when opening panels
  const label = getCurrentWindow().label;
  if (label === "settings") return <SettingsPanel />;
  if (label === "about") return <AboutPanel />;
  return <MainWindow />;
}

export default App;
