import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/skill-tree/me', () => {
    return HttpResponse.json([
      {
        id: 1,
        node_type: "CORE_TRUNK",
        title_vi: "Cơ bản 1",
        title_de: "Grundlagen 1",
        emoji: "🚀",
        user_status: "COMPLETED",
        cefr_level: "A1",
        phase: "GRUNDLAGEN",
        dependencies_met: true,
      },
      {
        id: 2,
        node_type: "SATELLITE_LEAF",
        title_vi: "Chuyên ngành IT",
        title_de: "IT Fachbegriffe",
        emoji: "💻",
        user_status: "LOCKED",
        cefr_level: "A1",
        phase: "BERUF",
        dependencies_met: true,
      }
    ]);
  }),
  
  http.post('*/api/skill-tree/:nodeId/unlock', () => {
    return HttpResponse.json({
      jobId: "mock-job-1234-5678",
      status: "ACCEPTED"
    }, { status: 202 });
  }),
  
  http.get('*/api/async-jobs/:jobId', () => {
    return HttpResponse.json({
      jobId: "mock-job-1234-5678",
      status: "COMPLETED",
      resultPayload: "{}"
    });
  })
];
