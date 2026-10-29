import { Composition } from "remotion";
import { Launch, TOTAL } from "./Launch";

export const RemotionRoot = () => <Composition id="Launch" component={Launch} durationInFrames={Math.round(TOTAL * 60)} fps={60} width={1920} height={1080} />;
