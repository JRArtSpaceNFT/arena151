// Add this at the end of DraftModeIntro component, before the closing </div>

      {/* Team Lock Modal */}
      {showTeamLock && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowTeamLock(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '90%' }}>
            <TeamLockFlow
              trainerId={selectedTrainer}
              team={selectedTeam}
              lockedOrder={lockedOrder}
              onLocked={() => {
                setIsTeamLocked(true);
                setShowTeamLock(false);
                setScreen('room-select');
              }}
            />
            
            <button
              onClick={() => setShowTeamLock(false)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 12,
                background: 'rgba(100,116,139,0.5)',
                border: '1px solid rgb(71,85,105)',
                borderRadius: 12,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
