import type { ExperienceState, PublicInput, Interpretation } from "../types";
import { GeomancyExperience } from "./geomancy";
import { CoffeeExperience } from "./coffee";
import { IfaExperience } from "./ifa";
import { JiaobeiExperience } from "./jiaobei";
import { OracleExperience } from "./oracle";

export function ExperiencePanel({
  state,
  onChange,
  input,
  motionPaused,
  interpretation,
}: {
  state: ExperienceState;
  onChange: (next: ExperienceState) => void;
  input: PublicInput;
  motionPaused: boolean;
  interpretation?: Interpretation;
}) {
  const props = { onChange, input, motionPaused };
  switch (state.kind) {
    case "geomancy":
      return (
        <GeomancyExperience
          state={state}
          interpretation={interpretation}
          {...props}
        />
      );
    case "coffee":
      return <CoffeeExperience state={state} {...props} />;
    case "ifa":
      return <IfaExperience state={state} {...props} />;
    case "jiaobei":
      return <JiaobeiExperience state={state} {...props} />;
    case "oracle":
      return <OracleExperience state={state} {...props} />;
  }
}
