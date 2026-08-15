'use client';

interface BottomDockProps {
  onScanClick: () => void;
  onManualClick: () => void;
}

export default function BottomDock({ onScanClick, onManualClick }: BottomDockProps) {
  return (
    <nav className="bottom-dock">
      <button className="dock-btn active">
        <span style={{ fontSize: '18px' }}>📊</span>
        <span>Özet</span>
      </button>

      <button className="dock-btn" onClick={onManualClick}>
        <span style={{ fontSize: '18px' }}>➕</span>
        <span>Ekle</span>
      </button>

      {/* Ortadaki Büyük Hızlı Tara Butonu */}
      <button className="scan-center-btn" onClick={onScanClick} aria-label="Fiş / Fatura Tara">
        <span style={{ fontSize: '16px' }}>📸</span>
        <span>HIZLI TARA</span>
      </button>

      <button className="dock-btn">
        <span style={{ fontSize: '18px' }}>🚗</span>
        <span>Araç/Ev</span>
      </button>

      <button className="dock-btn">
        <span style={{ fontSize: '18px' }}>🧬</span>
        <span>Sağlık</span>
      </button>
    </nav>
  );
}
