import Svg, { Path, Rect } from "react-native-svg";

/** Split Daily mark: a coin split in two, halves nudged apart. Matches assets/images/icon.png. */
export function AppLogo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Split Daily logo">
      <Rect x={0} y={0} width={100} height={100} rx={22} fill="#20392A" />
      <Path d="M47 16.4 A30 30 0 0 0 47 76.4 Z" fill="#C8F169" />
      <Path d="M53 23.6 A30 30 0 0 1 53 83.6 Z" fill="#F2A39D" />
    </Svg>
  );
}
