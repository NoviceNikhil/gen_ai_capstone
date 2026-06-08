import { Navigate } from "react-router-dom";
import FeatureScreen from "./FeatureScreen";
import { FEATURE_SCREEN_CATALOG } from "./featureCatalog";

export default function RoleFeaturePage({ screenKey, fallbackPath }) {
  const config = FEATURE_SCREEN_CATALOG[screenKey];

  if (!config) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <FeatureScreen {...config} />;
}
