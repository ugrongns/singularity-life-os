'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Sparkles, User, Users, Check } from 'lucide-react';

export interface FamilyMemberItem {
  id: string;
  name: string;
  relationship_type?: string;
  family_role?: string;
  avatar_url?: string | null;
}

interface HealthSubNavProps {
  members?: FamilyMemberItem[];
  selectedMemberId?: string | null;
  onSelectMember?: (memberId: string | null) => void;
}

export default function HealthSubNav({
  members = [],
  selectedMemberId = null,
  onSelectMember
}: HealthSubNavProps) {
  const pathname = usePathname();
  const isHealth = pathname === '/health';
  const isWellness = pathname === '/wellness';

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'var(--glass-surface)',
        borderBottom: '1px solid var(--border)',
        margin: '0 -16px 18px',
        padding: '8px 16px',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          width: '100%',
          boxSizing: 'border-box'
        }}
        className="no-scrollbar"
      >
        {/* Sol Segmented Control: Modüller Arası Geçiş */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--surface-subtle)',
            padding: '2px',
            borderRadius: '9px',
            border: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          <Link
            href="/health"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '7px',
              textDecoration: 'none',
              backgroundColor: isHealth ? 'var(--surface)' : 'transparent',
              color: isHealth ? 'var(--blue)' : 'var(--text-muted)',
              border: isHealth ? '1px solid var(--border)' : '1px solid transparent',
              boxShadow: isHealth ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Activity size={14} />
            <span>Beslenme & Oruç</span>
          </Link>

          <Link
            href="/wellness"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '7px',
              textDecoration: 'none',
              backgroundColor: isWellness ? 'var(--surface)' : 'transparent',
              color: isWellness ? 'var(--emerald)' : 'var(--text-muted)',
              border: isWellness ? '1px solid var(--border)' : '1px solid transparent',
              boxShadow: isWellness ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Sparkles size={14} />
            <span>Yaşam & Takviye</span>
          </Link>
        </div>

        {/* Sağ Segment: Aile Üyesi Seçici (Family Member Picker) */}
        {onSelectMember && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--surface-subtle)',
                padding: '2px',
                borderRadius: '9px',
                border: '1px solid var(--border)'
              }}
            >
              {/* Tümü Hapı */}
              <button
                type="button"
                onClick={() => onSelectMember(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: selectedMemberId === null ? 'var(--surface)' : 'transparent',
                  color: selectedMemberId === null ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: selectedMemberId === null ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: selectedMemberId === null ? 'var(--border)' : 'transparent',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Users size={13} />
                <span>Tümü</span>
              </button>

              {/* Dinamik Üyeler */}
              {members.map(member => {
                const isSelected = selectedMemberId === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onSelectMember(member.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--surface)' : 'transparent',
                      color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: isSelected ? 'var(--border)' : 'transparent',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                    title={member.relationship_type || member.family_role || ''}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--border)',
                        color: isSelected ? '#6366F1' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: 900
                      }}
                    >
                      {member.name ? member.name.charAt(0).toUpperCase() : <User size={9} />}
                    </div>
                    <span>{member.name?.split(' ')[0] || 'Üye'}</span>
                    {isSelected && <Check size={12} color="#6366F1" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
