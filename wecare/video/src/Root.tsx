import { Composition } from "remotion";
import { Launch } from "./Launch";

// 107.2 s at 60 fps.
export const RemotionRoot = () => <Composition id="Launch" component={Launch} durationInFrames={6432} fps={60} width={1920} height={1080} />;
