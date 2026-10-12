import { Link } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';

/**
 * The phone's primary action, in thumb reach at the bottom of the screen.
 * Hidden from 768px up by CSS, where the hero's own buttons take over. Only
 * rendered for roles that can upload CVs.
 */
export default function QuickActionFab() {
  return (
    <Link to="/upload" className="quick-fab">
      <UploadCloud size={20} strokeWidth={2} aria-hidden="true" />
      Upload CVs
    </Link>
  );
}
