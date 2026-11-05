import { Router, Request, Response } from 'express';
import {
  fetchMatchComments,
  fetchMatchGraph,
  fetchMatchHighlights,
  fetchMatchIncidents,
  fetchMatchOdds,
  fetchMatchShotmap,
  fetchPrediction,
} from '../services/football-api';

const router = Router();

function parseEventId(req: Request): number {
  return parseInt(String(req.params.eventId), 10);
}

function isValidEventId(eventId: number): boolean {
  return Number.isInteger(eventId) && eventId > 0;
}

async function sendPublicMatchData(
  req: Request,
  res: Response,
  fetcher: (eventId: number) => Promise<any>,
  fallback: any
): Promise<void> {
  const eventId = parseEventId(req);
  if (!isValidEventId(eventId)) {
    res.status(400).json({ error: 'Gecerli bir eventId gerekli.' });
    return;
  }

  try {
    res.json(await fetcher(eventId));
  } catch {
    res.json(fallback);
  }
}

router.get('/matches/:eventId/predictions', (req, res) =>
  sendPublicMatchData(req, res, fetchPrediction, {})
);

router.get('/matches/:eventId/odds', (req, res) =>
  sendPublicMatchData(req, res, fetchMatchOdds, { markets: [] })
);

router.get('/matches/:eventId/shotmap', (req, res) =>
  sendPublicMatchData(req, res, fetchMatchShotmap, [])
);

router.get('/matches/:eventId/graph', (req, res) =>
  sendPublicMatchData(req, res, fetchMatchGraph, { graphPoints: [] })
);

router.get('/matches/:eventId/comments', (req, res) =>
  sendPublicMatchData(req, res, fetchMatchComments, [])
);

router.get('/matches/:eventId/incidents', (req, res) =>
  sendPublicMatchData(req, res, fetchMatchIncidents, [])
);

router.get('/matches/:eventId/highlights', (req, res) =>
  sendPublicMatchData(req, res, fetchMatchHighlights, [])
);

export default router;
