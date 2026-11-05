import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { LanguageChoice } from './LanguageChoice';
import { Modal } from './ui';

/**
 * Account has no saved language. If the visitor already chose one at sign-in, save it silently;
 * otherwise ask once.
 */
export const OnboardingModal: React.FC = () => {
  const { language, hasChosenLanguage } = useLanguage();
  const { needsLanguageSelection, updateLanguagePreference } = useAuth();

  useEffect(() => {
    if (needsLanguageSelection && hasChosenLanguage) {
      updateLanguagePreference(language);
    }
  }, [needsLanguageSelection, hasChosenLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!needsLanguageSelection || hasChosenLanguage) return null;

  return (
    <Modal
      open
      dismissable={false}
      onClose={() => undefined}
      title="Choose your language · Pumili ng wika"
      description="Boss Narra, your finance checkup, and every recommendation will use it. You can change it anytime from the top bar."
    >
      <LanguageChoice current={language} onChoose={(lang) => updateLanguagePreference(lang)} />
    </Modal>
  );
};
