import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SOFT_TACTILE } from '../src/theme/softTactile';

/**
 * Destino de los deep links `wearwise://auth-callback` (confirmación de correo, OAuth, recuperación).
 * AuthProvider procesa los tokens; en cuanto cambia la sesión, el guard de rutas navega solo.
 */
export default function AuthCallbackScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SOFT_TACTILE.colors.canvas,
      }}
    >
      <ActivityIndicator color={SOFT_TACTILE.colors.terracotta} />
    </View>
  );
}
