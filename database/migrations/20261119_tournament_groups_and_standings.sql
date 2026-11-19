-- Migration: Add Tournament Groups, Match Results, and Standings Table
-- Date: 2026-11-19

-- 1. Add group_name to cst_tournament_teams if not exists
ALTER TABLE cst_tournament_teams
ADD COLUMN group_name VARCHAR(50) DEFAULT NULL AFTER status;

-- 2. Add group_name, win_margin, result_summary, man_of_the_match_id to cst_tournament_matches
ALTER TABLE cst_tournament_matches
ADD COLUMN group_name VARCHAR(50) DEFAULT NULL AFTER round_name,
ADD COLUMN win_margin VARCHAR(100) DEFAULT NULL AFTER winner_team_id,
ADD COLUMN result_summary VARCHAR(255) DEFAULT NULL AFTER win_margin,
ADD COLUMN man_of_the_match_id INT DEFAULT NULL AFTER result_summary;

-- 3. Create cst_tournament_standings table for points table and team scores
CREATE TABLE IF NOT EXISTS cst_tournament_standings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    team_id INT NOT NULL,
    group_name VARCHAR(50) DEFAULT 'Group A',
    played INT DEFAULT 0,
    won INT DEFAULT 0,
    lost INT DEFAULT 0,
    tied INT DEFAULT 0,
    no_result INT DEFAULT 0,
    points INT DEFAULT 0,
    net_run_rate DECIMAL(6,3) DEFAULT 0.000,
    runs_for INT DEFAULT 0,
    overs_for DECIMAL(5,1) DEFAULT 0.0,
    runs_against INT DEFAULT 0,
    overs_against DECIMAL(5,1) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tourney_team (tournament_id, team_id),
    INDEX idx_tourney_grp (tournament_id, group_name)
);
