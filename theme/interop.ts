import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// NativeWind handles React Native's own components. Third-party views need
// registering once so their `className` is turned into `style`.
cssInterop(SafeAreaView, { className: "style" });
cssInterop(LinearGradient, { className: "style" });
cssInterop(BlurView, { className: "style" });
cssInterop(Animated.View, { className: "style" });
