import type { PomodoroSessionLog } from '../types/ecosystem';
import type {
  StudyEvaluation,
  StudySubject,
  StudyTaskItem,
} from '../types/study2';

export type CitationFormat = 'apa7' | 'mla9' | 'chicago' | 'ieee' | 'iso690';

export interface CitationInput {
  authors: string; // e.g. "Bunge, Mario" or "Mario Bunge; Karl Popper"
  year: string;
  title: string;
  publisherOrJournal?: string;
  volumeIssue?: string;
  pages?: string;
  urlOrDoi?: string;
  city?: string;
  kind: 'libro' | 'articulo' | 'web';
}

export function generateAcademicCitation(
  format: CitationFormat,
  input: CitationInput
): string {
  const authors = input.authors.trim() || 'Autor desconocido';
  const year = input.year.trim() || 's. f.';
  const title = input.title.trim() || 'Título sin especificar';
  const pub = input.publisherOrJournal?.trim() || '';
  const vol = input.volumeIssue?.trim() || '';
  const pages = input.pages?.trim() || '';
  const link = input.urlOrDoi?.trim() || '';
  const city = input.city?.trim() || '';

  switch (format) {
    case 'apa7': {
      if (input.kind === 'articulo') {
        const parts = [
          `${authors} (${year}).`,
          `${title}.`,
          pub ? `${pub}${vol ? `, ${vol}` : ''}${pages ? `, ${pages}` : ''}.` : '',
          link ? `${link}` : '',
        ];
        return parts.filter(Boolean).join(' ');
      }
      if (input.kind === 'web') {
        return [
          `${authors} (${year}).`,
          `${title}.`,
          pub ? `${pub}.` : '',
          link,
        ]
          .filter(Boolean)
          .join(' ');
      }
      return [
        `${authors} (${year}).`,
        `${title}.`,
        pub ? `${pub}.` : '',
        link,
      ]
        .filter(Boolean)
        .join(' ');
    }

    case 'mla9': {
      return [
        `${authors}.`,
        input.kind === 'articulo' ? `"${title}."` : `${title}.`,
        pub ? `${pub}${vol ? `, ${vol}` : ''},` : '',
        `${year}${pages ? `, pp. ${pages}` : ''}.`,
        link ? `${link}.` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }

    case 'chicago': {
      return [
        `${authors}.`,
        `${year}.`,
        input.kind === 'articulo' ? `"${title}."` : `${title}.`,
        city && pub ? `${city}: ${pub}.` : pub ? `${pub}.` : '',
        pages ? `${pages}.` : '',
        link,
      ]
        .filter(Boolean)
        .join(' ');
    }

    case 'ieee': {
      return [
        `${authors},`,
        `"${title},"`,
        pub ? `${pub},` : '',
        vol ? `${vol},` : '',
        pages ? `pp. ${pages},` : '',
        `${year}.`,
        link ? `[En línea]. Disponible en: ${link}` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }

    case 'iso690': {
      return [
        `${authors.toUpperCase()}.`,
        `${title}.`,
        city && pub ? `${city}: ${pub},` : pub ? `${pub},` : '',
        `${year}.`,
        pages ? `p. ${pages}.` : '',
        link ? `Disponible en: ${link}` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
  }
}

export interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  text: string;
  lineA?: number;
  lineB?: number;
}

/**
 * Computes a real Longest Common Subsequence (LCS) line-by-line diff between two texts.
 */
export function computeLineDiff(textA: string, textB: string): {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  similarityPercent: number;
} {
  const a = textA.replace(/\r\n/g, '\n').split('\n');
  const b = textB.replace(/\r\n/g, '\n').split('\n');

  const n = a.length;
  const m = b.length;

  // Guard for very large documents: compare up to 450 lines per side to keep UI instant
  const limitA = Math.min(n, 450);
  const limitB = Math.min(m, 450);

  const dp: number[][] = Array.from({ length: limitA + 1 }, () =>
    new Array<number>(limitB + 1).fill(0)
  );

  for (let i = limitA - 1; i >= 0; i -= 1) {
    for (let j = limitB - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  while (i < limitA && j < limitB) {
    if (a[i] === b[j]) {
      result.push({ type: 'equal', text: a[i], lineA: i + 1, lineB: j + 1 });
      unchangedCount += 1;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', text: a[i], lineA: i + 1 });
      removedCount += 1;
      i += 1;
    } else {
      result.push({ type: 'added', text: b[j], lineB: j + 1 });
      addedCount += 1;
      j += 1;
    }
  }
  while (i < limitA) {
    result.push({ type: 'removed', text: a[i], lineA: i + 1 });
    removedCount += 1;
    i += 1;
  }
  while (j < limitB) {
    result.push({ type: 'added', text: b[j], lineB: j + 1 });
    addedCount += 1;
    j += 1;
  }

  const totalUnique = unchangedCount + addedCount + removedCount;
  const similarityPercent =
    totalUnique === 0 ? 100 : Math.round((unchangedCount / totalUnique) * 100);

  return {
    lines: result,
    addedCount,
    removedCount,
    unchangedCount,
    similarityPercent,
  };
}

export interface RealStudyProgressReport {
  activeSubjectsCount: number;
  archivedSubjectsCount: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalTopics: number;
  completedTopics: number;
  evaluationsTotal: number;
  evaluationsTaken: number;
  gradedEvaluationsCount: number;
  averageGrade: number | null; // null if no real grades exist (never fake 0 or 85%)
  overallCompletionPercent: number | null; // null if no trackable items exist
  totalStudyMinutes: number;
  perSubject: Array<{
    subjectId: string;
    name: string;
    color: string;
    completedItems: number;
    totalItems: number;
    completionPercent: number | null;
    averageGrade: number | null;
  }>;
}

/**
 * Calculates 100% real academic progress from actual user records.
 * Never invents percentages or averages when no data has been recorded.
 */
export function computeRealStudyProgress(params: {
  subjects: StudySubject[];
  tasks: StudyTaskItem[];
  evaluations: StudyEvaluation[];
  pomodoroLogs: PomodoroSessionLog[];
}): RealStudyProgressReport {
  const { subjects, tasks, evaluations, pomodoroLogs } = params;
  const activeSubjects = subjects.filter((s) => !s.archived);
  const archivedSubjects = subjects.filter((s) => s.archived);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const pendingTasks = tasks.length - completedTasks;

  let totalTopics = 0;
  let completedTopics = 0;

  const perSubject = activeSubjects.map((sub) => {
    const subTopics = sub.units.flatMap((u) => u.topics);
    const subTopicsDone = subTopics.filter((tp) => tp.completed).length;
    totalTopics += subTopics.length;
    completedTopics += subTopicsDone;

    const subTasks = tasks.filter((t) => t.subjectId === sub.id);
    const subTasksDone = subTasks.filter((t) => t.completed).length;

    const totalItems = subTopics.length + subTasks.length;
    const completedItems = subTopicsDone + subTasksDone;
    const completionPercent =
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null;

    const subGraded = evaluations.filter(
      (ev) => ev.subjectId === sub.id && typeof ev.grade === 'number' && Number.isFinite(ev.grade)
    );
    const averageGrade =
      subGraded.length > 0
        ? Number(
            (
              subGraded.reduce((acc, ev) => acc + (ev.grade as number), 0) / subGraded.length
            ).toFixed(2)
          )
        : null;

    return {
      subjectId: sub.id,
      name: sub.name,
      color: sub.color,
      completedItems,
      totalItems,
      completionPercent,
      averageGrade,
    };
  });

  const evaluationsTaken = evaluations.filter(
    (ev) => ev.status === 'rendida' || ev.status === 'aprobada' || ev.status === 'desaprobada'
  ).length;
  const graded = evaluations.filter(
    (ev) => typeof ev.grade === 'number' && Number.isFinite(ev.grade)
  );
  const averageGrade =
    graded.length > 0
      ? Number(
          (graded.reduce((acc, ev) => acc + (ev.grade as number), 0) / graded.length).toFixed(2)
        )
      : null;

  const totalTrackable = totalTopics + tasks.length;
  const totalCompleted = completedTopics + completedTasks;
  const overallCompletionPercent =
    totalTrackable > 0 ? Math.round((totalCompleted / totalTrackable) * 100) : null;

  const totalStudyMinutes = pomodoroLogs.reduce(
    (acc, log) => acc + (Number.isFinite(log.minutes) ? log.minutes : 0),
    0
  );

  return {
    activeSubjectsCount: activeSubjects.length,
    archivedSubjectsCount: archivedSubjects.length,
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks,
    totalTopics,
    completedTopics,
    evaluationsTotal: evaluations.length,
    evaluationsTaken,
    gradedEvaluationsCount: graded.length,
    averageGrade,
    overallCompletionPercent,
    totalStudyMinutes,
    perSubject,
  };
}
