import React from 'react';

interface Props {
  message: string | null;
}

/** Message d’état ou d’échec d’écriture, au-dessus des onglets (D-62) : zone `role="status"` à hauteur réservée. */
const MessageStockage: React.FC<Props> = ({ message }) => <p role="status" className="mt-2 min-h-6">{message}</p>;

export default MessageStockage;
