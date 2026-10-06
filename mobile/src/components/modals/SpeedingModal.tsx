import React from 'react';
import { DriverSafetyEventModal, DriverSafetyEventModalProps } from './DriverSafetyEventModal';

export const SpeedingModal: React.FC<DriverSafetyEventModalProps> = (props) => {
  return <DriverSafetyEventModal {...props} initialEventType="speeding" />;
};
