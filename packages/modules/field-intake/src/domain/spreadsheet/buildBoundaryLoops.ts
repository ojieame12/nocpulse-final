import { gridVertexToPlanarPoint } from "./quarterGrid";
import type { GridCell, PlanarPoint, PlanarRing } from "./types";

export function buildBoundaryLoops(cells: readonly GridCell[]) {
  const edges = new Map<string, { start: PlanarPoint; end: PlanarPoint }>();

  for (const cell of cells) {
    const topLeft = [cell.x, cell.y + 1] as const satisfies PlanarPoint;
    const topRight = [cell.x + 1, cell.y + 1] as const satisfies PlanarPoint;
    const bottomRight = [cell.x + 1, cell.y] as const satisfies PlanarPoint;
    const bottomLeft = [cell.x, cell.y] as const satisfies PlanarPoint;

    const cellEdges = [
      { start: topLeft, end: topRight },
      { start: topRight, end: bottomRight },
      { start: bottomRight, end: bottomLeft },
      { start: bottomLeft, end: topLeft },
    ];

    for (const edge of cellEdges) {
      const key = getEdgeKey(edge.start, edge.end);

      if (edges.has(key)) {
        edges.delete(key);
      } else {
        edges.set(key, edge);
      }
    }
  }

  const outgoing = new Map<string, Array<{ start: PlanarPoint; end: PlanarPoint }>>();

  for (const edge of edges.values()) {
    const key = getPointKey(edge.start);
    const existing = outgoing.get(key);

    if (existing) {
      existing.push(edge);
    } else {
      outgoing.set(key, [edge]);
    }
  }

  const loops: PlanarRing[] = [];

  while (outgoing.size > 0) {
    const firstList = outgoing.values().next().value as
      | Array<{ start: PlanarPoint; end: PlanarPoint }>
      | undefined;
    const firstEdge = firstList?.[0];

    if (!firstEdge) {
      break;
    }

    const start = firstEdge.start;
    let current = firstEdge;
    const ring: PlanarPoint[] = [gridVertexToPlanarPoint(start)];

    while (current) {
      consumeEdge(outgoing, current);
      ring.push(gridVertexToPlanarPoint(current.end));

      if (current.end[0] === start[0] && current.end[1] === start[1]) {
        break;
      }

      const nextList = outgoing.get(getPointKey(current.end));
      const nextEdge = nextList?.[0];

      if (!nextEdge) {
        break;
      }

      current = nextEdge;
    }

    if (ring.length >= 4) {
      loops.push(simplifyRing(ring));
    }
  }

  return loops;
}

function simplifyRing(ring: readonly PlanarPoint[]) {
  if (ring.length <= 4) {
    return ring;
  }

  const openRing = ring.slice(0, -1);
  const simplified = openRing.filter((point, index) => {
    const previous = openRing[(index - 1 + openRing.length) % openRing.length];
    const next = openRing[(index + 1) % openRing.length];
    const sameX = previous[0] === point[0] && point[0] === next[0];
    const sameY = previous[1] === point[1] && point[1] === next[1];

    return !(sameX || sameY);
  });

  if (simplified.length === 0) {
    return ring;
  }

  return [
    ...simplified,
    [...simplified[0]] as PlanarPoint,
  ] as const;
}

function consumeEdge(
  outgoing: Map<string, Array<{ start: PlanarPoint; end: PlanarPoint }>>,
  edge: { start: PlanarPoint; end: PlanarPoint },
) {
  const list = outgoing.get(getPointKey(edge.start));

  if (!list) {
    return;
  }

  const index = list.findIndex((candidate) =>
    candidate.start[0] === edge.start[0]
    && candidate.start[1] === edge.start[1]
    && candidate.end[0] === edge.end[0]
    && candidate.end[1] === edge.end[1],
  );

  if (index >= 0) {
    list.splice(index, 1);
  }

  if (list.length === 0) {
    outgoing.delete(getPointKey(edge.start));
  }
}

function getPointKey(point: PlanarPoint) {
  return `${point[0]},${point[1]}`;
}

function getEdgeKey(start: PlanarPoint, end: PlanarPoint) {
  const startKey = getPointKey(start);
  const endKey = getPointKey(end);

  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}
