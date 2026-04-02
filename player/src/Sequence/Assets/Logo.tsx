import { Sequence } from "remotion";
import { FC } from "react";
import { cssStringToReactStyle } from "../../utils/cssStringToReactStyle";

interface Props {
  logo: string;
  logoStyle: string;
}

export const Logo: FC<Props> = ({ logo, logoStyle }) => {
  const parsedStyle = cssStringToReactStyle(logoStyle || "top: 90px; right: 65px;");
  const hasSize =
    typeof parsedStyle.width !== "undefined" ||
    typeof parsedStyle.height !== "undefined" ||
    typeof parsedStyle.maxWidth !== "undefined";

  const style: React.CSSProperties = {
    position: "absolute",
    ...parsedStyle,
    ...(hasSize ? {} : { width: "96px" }),
  };
  const StyledLogo: FC = () => {
    return <img src={logo} style={style} alt="Logo" />;
  };

  return <Sequence>{<StyledLogo />}</Sequence>;
};
