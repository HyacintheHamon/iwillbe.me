import "react-native-svg";

declare module "react-native-svg" {
  interface SvgProps {
    // Phosphor 3.0.6 passes a CSS class to SVGs; react-native-svg forwards it on web.
    className?: string;
  }
}
