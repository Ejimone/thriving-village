export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:courseId/days/:day/material',
      handler: 'academy-material.find',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/courses/:courseId/days/:day/material',
      handler: 'academy-material.put',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/courses/:courseId/days/:day/material',
      handler: 'academy-material.delete',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/courses/:courseId/days/:day/material/mux-upload',
      handler: 'academy-material.muxUploadUrl',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/courses/:courseId/days/:day/material/playback-token',
      handler: 'academy-material.getPlaybackToken',
      config: { policies: [] },
    },
  ],
};
