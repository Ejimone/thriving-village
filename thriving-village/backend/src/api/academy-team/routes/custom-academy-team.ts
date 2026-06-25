const teamScoped = { policies: ['global::is-team-cohort-facilitator'] };

export default {
  routes: [
    { method: 'PUT', path: '/teams/:id', handler: 'academy-team.renameTeam', config: teamScoped },
    { method: 'DELETE', path: '/teams/:id', handler: 'academy-team.deleteTeam', config: teamScoped },
    { method: 'POST', path: '/teams/:id/members', handler: 'academy-team.addMember', config: teamScoped },
    { method: 'DELETE', path: '/teams/:id/members/:userId', handler: 'academy-team.removeMember', config: teamScoped },
  ],
};
