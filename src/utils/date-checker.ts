/**
 * Date Checker Utility for XR Awards
 * 
 * Provides functions to check event dates and determine appropriate CTAs and messages
 * based on the current date relative to key event milestones.
 */

import { supabase } from './supabase';

export interface EventDetails {
  id: string;
  event_name: string;
  event_year: number;
  location: string;
  description?: string;
  organizer_name?: string;
  nominations_open?: string;
  nominations_close?: string;
  finalists_announced?: string;
  judging_period_start?: string;
  judging_period_end?: string;
  awards_ceremony?: string;
  nomination_portal_url?: string;
  tickets_portal_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventPhase {
  phase: 'pre-nominations' | 'nominations-open' | 'nominations-closed' | 'finalists-announced' | 'judging-period' | 'post-ceremony';
  daysUntilNext: number;
  nextMilestone: string;
  ctaButton: {
    text: string;
    href: string;
    variant: 'primary' | 'secondary' | 'outline';
  };
  statusMessage: string;
  isUrgent: boolean;
  debugInfo?: any;
}

/**
 * Get the active event details
 */
export async function getActiveEventDetails(): Promise<EventDetails | null> {
  const { data: eventDetails } = await supabase
    .from('event_details')
    .select('*')
    .eq('is_active', true)
    .single();

  return eventDetails;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate time difference and return appropriate message
 */
function getTimeUntilMessage(targetDate: Date, currentTime: Date): { days: number; message: string } {
  const diffTime = targetDate.getTime() - currentTime.getTime();
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffTime <= 0) {
    return { days: 0, message: 'Today' };
  } else if (diffHours < 24) {
    return { days: 0, message: `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}` };
  } else {
    return { days: diffDays, message: `in ${diffDays} day${diffDays !== 1 ? 's' : ''}` };
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Determine the current event phase and appropriate messaging
 */
export async function getEventPhase(): Promise<EventPhase> {
  const eventDetails = await getActiveEventDetails();
  
  if (!eventDetails) {
    // Fallback for when no active event is found
    return {
      phase: 'pre-nominations',
      daysUntilNext: 0,
      nextMilestone: 'Event details coming soon',
      ctaButton: {
        text: 'Register Interest',
        href: '/register-interest/',
        variant: 'primary'
      },
      statusMessage: 'Event details are being finalized',
      isUrgent: false,
      debugInfo: { noEventDetails: true }
    };
  }

  const now = new Date();
  // Create today's date in UTC to avoid timezone issues
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  
  // For debugging - let's use the actual current time for more precise comparisons
  const currentTime = new Date();
  
  // Parse event dates
  const nominationsOpen = eventDetails.nominations_open ? new Date(eventDetails.nominations_open) : null;
  const nominationsClose = eventDetails.nominations_close ? new Date(eventDetails.nominations_close) : null;
  const finalistsAnnounced = eventDetails.finalists_announced ? new Date(eventDetails.finalists_announced) : null;
  const judgingStart = eventDetails.judging_period_start ? new Date(eventDetails.judging_period_start) : null;
  const judgingEnd = eventDetails.judging_period_end ? new Date(eventDetails.judging_period_end) : null;
  const ceremony = eventDetails.awards_ceremony ? new Date(eventDetails.awards_ceremony) : null;

  // Debug information
  const debugInfo = {
    currentTime: currentTime.toISOString(),
    today: today.toISOString(),
    nominationsOpen: nominationsOpen?.toISOString() || 'null',
    nominationsClose: nominationsClose?.toISOString() || 'null',
    finalistsAnnounced: finalistsAnnounced?.toISOString() || 'null',
    judgingStart: judgingStart?.toISOString() || 'null',
    judgingEnd: judgingEnd?.toISOString() || 'null',
    ceremony: ceremony?.toISOString() || 'null',
    comparisons: {
      currentTimeLessThanNominationsOpen: nominationsOpen ? currentTime < nominationsOpen : 'N/A',
      currentTimeBetweenNominations: nominationsOpen && nominationsClose ? 
        (currentTime >= nominationsOpen && currentTime <= nominationsClose) : 'N/A',
      currentTimeAfterNominationsClose: nominationsClose ? currentTime > nominationsClose : 'N/A',
      currentTimeLessThanFinalists: finalistsAnnounced ? currentTime < finalistsAnnounced : 'N/A',
      currentTimeAfterFinalists: finalistsAnnounced ? currentTime >= finalistsAnnounced : 'N/A',
      currentTimeLessThanJudgingStart: judgingStart ? currentTime < judgingStart : 'N/A',
      currentTimeBetweenJudging: judgingStart && judgingEnd ? 
        (currentTime >= judgingStart && currentTime <= judgingEnd) : 'N/A',
      currentTimeAfterJudgingBeforeCeremony: judgingEnd && ceremony ? 
        (currentTime > judgingEnd && currentTime < ceremony) : 'N/A',
      currentTimeAfterCeremony: ceremony ? currentTime > ceremony : 'N/A'
    }
  };

  // Debug logging disabled

  // Determine phase
  if (nominationsOpen && currentTime < nominationsOpen) {
    // Pre-nominations phase
    const daysUntil = daysBetween(today, nominationsOpen);
    return {
      phase: 'pre-nominations',
      daysUntilNext: daysUntil,
      nextMilestone: `Nominations open ${formatDate(nominationsOpen)}`,
      ctaButton: {
        text: 'Register Interest',
        href: '/register-interest/',
        variant: 'primary'
      },
      statusMessage: `Nominations open in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      isUrgent: daysUntil <= 7,
      debugInfo: debugInfo
    };
  } else if (nominationsOpen && nominationsClose && currentTime >= nominationsOpen && currentTime <= nominationsClose) {
    // Nominations open phase
    const daysUntil = daysBetween(today, nominationsClose);
    return {
      phase: 'nominations-open',
      daysUntilNext: daysUntil,
      nextMilestone: `Nominations close ${formatDate(nominationsClose)}`,
      ctaButton: {
        text: 'Nominate Now',
        href: eventDetails.nomination_portal_url || 'https://app.aixr.org/e/20a6e09d-7e86-488d-8436-1cd162d0f5df',
        variant: 'primary'
      },
      statusMessage: `Nominations close in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      isUrgent: daysUntil <= 7,
      debugInfo: debugInfo
    };
  } else if (nominationsClose && finalistsAnnounced && currentTime > nominationsClose && currentTime < finalistsAnnounced) {
    // Nominations closed, waiting for finalists
    const timeInfo = getTimeUntilMessage(finalistsAnnounced, currentTime);
    return {
      phase: 'nominations-closed',
      daysUntilNext: timeInfo.days,
      nextMilestone: `Finalists announced ${formatDate(finalistsAnnounced)}`,
      ctaButton: {
        text: 'Secure Tickets',
        href: eventDetails.tickets_portal_url || 'https://events.unitedxr.eu/2025?utm_source=AIXR&utm_medium=XR+Awards+Website&utm_campaign=link',
        variant: 'primary'
      },
      statusMessage: `Finalists announced ${timeInfo.message}`,
      isUrgent: timeInfo.days <= 1 || timeInfo.message.includes('hour'),
      debugInfo: debugInfo
    };
  } else if (finalistsAnnounced && judgingStart && currentTime >= finalistsAnnounced && currentTime < judgingStart) {
    // Finalists announced, waiting for judging
    const daysUntil = daysBetween(today, judgingStart);
    return {
      phase: 'finalists-announced',
      daysUntilNext: daysUntil,
      nextMilestone: `Judging begins ${formatDate(judgingStart)}`,
      ctaButton: {
        text: 'Secure Tickets',
        href: eventDetails.tickets_portal_url || 'https://events.unitedxr.eu/2025?utm_source=AIXR&utm_medium=XR+Awards+Website&utm_campaign=link',
        variant: 'primary'
      },
      statusMessage: `Judging begins in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      isUrgent: false,
      debugInfo: debugInfo
    };
  } else if (judgingStart && judgingEnd && currentTime >= judgingStart && currentTime <= judgingEnd) {
    // Judging period
    const daysUntil = daysBetween(today, judgingEnd);
    return {
      phase: 'judging-period',
      daysUntilNext: daysUntil,
      nextMilestone: `Judging ends ${formatDate(judgingEnd)}`,
      ctaButton: {
        text: 'Secure Tickets',
        href: eventDetails.tickets_portal_url || 'https://events.unitedxr.eu/2025?utm_source=AIXR&utm_medium=XR+Awards+Website&utm_campaign=link',
        variant: 'primary'
      },
      statusMessage: `Judging in progress - ${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining`,
      isUrgent: false,
      debugInfo: debugInfo
    };
  } else if (judgingEnd && ceremony && currentTime > judgingEnd && currentTime < ceremony) {
    // Post-judging, pre-ceremony phase
    const daysUntil = daysBetween(today, ceremony);
    return {
      phase: 'finalists-announced',
      daysUntilNext: daysUntil,
      nextMilestone: `Awards ceremony ${formatDate(ceremony)}`,
      ctaButton: {
        text: 'Secure Tickets',
        href: eventDetails.tickets_portal_url || 'https://events.unitedxr.eu/2025?utm_source=AIXR&utm_medium=XR+Awards+Website&utm_campaign=link',
        variant: 'primary'
      },
      statusMessage: `Awards ceremony in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      isUrgent: daysUntil <= 7,
      debugInfo: debugInfo
    };
  } else if (ceremony && currentTime > ceremony) {
    // Post-ceremony
    return {
      phase: 'post-ceremony',
      daysUntilNext: 0,
      nextMilestone: 'Event completed',
      ctaButton: {
        text: 'View Winners',
        href: `/winners-and-finalists-${eventDetails.event_year}/`,
        variant: 'primary'
      },
      statusMessage: 'Event completed - view the winners',
      isUrgent: false,
      debugInfo: debugInfo
    };
  } else {
    // Default fallback
    return {
      phase: 'pre-nominations',
      daysUntilNext: 0,
      nextMilestone: 'Event details coming soon',
      ctaButton: {
        text: 'Register Interest',
        href: '/register-interest/',
        variant: 'primary'
      },
      statusMessage: 'Event details are being finalized',
      isUrgent: false,
      debugInfo: debugInfo
    };
  }
}

/**
 * Get CTA button configuration for a specific context
 */
export async function getCTAButton(context: 'header' | 'hero' | 'footer' | 'travel' = 'header') {
  const eventPhase = await getEventPhase();
  
  // Context-specific overrides
  switch (context) {
    case 'header':
      // Header should show the most important action
      return eventPhase.ctaButton;
    
    case 'hero':
      // Hero section might have different messaging
      if (eventPhase.phase === 'nominations-open') {
        return {
          ...eventPhase.ctaButton,
          text: 'Submit Your Nomination'
        };
      }
      return eventPhase.ctaButton;
    
    case 'footer':
      // Footer might be more generic
      if (eventPhase.phase === 'post-ceremony') {
        return {
          text: 'Register Interest Now',
          href: '/register-interest/',
          variant: 'primary' as const
        };
      }
      return eventPhase.ctaButton;
    
    case 'travel':
      // Travel page should always focus on tickets
      if (eventPhase.phase !== 'post-ceremony') {
        return {
          text: 'Secure Tickets',
          href: eventPhase.ctaButton.href,
          variant: 'primary' as const
        };
      }
      return eventPhase.ctaButton;
    
    default:
      return eventPhase.ctaButton;
  }
}

/**
 * Get status message for display
 */
export async function getStatusMessage(): Promise<string> {
  const eventPhase = await getEventPhase();
  return eventPhase.statusMessage;
}

/**
 * Check if we're in a specific phase
 */
export async function isInPhase(phase: EventPhase['phase']): Promise<boolean> {
  const eventPhase = await getEventPhase();
  return eventPhase.phase === phase;
}

/**
 * Check if nominations are currently open
 */
export async function areNominationsOpen(): Promise<boolean> {
  return await isInPhase('nominations-open');
}

/**
 * Check if we're after the ceremony
 */
export async function isAfterCeremony(): Promise<boolean> {
  return await isInPhase('post-ceremony');
}

/**
 * Get countdown information for display
 */
export async function getCountdownInfo(): Promise<{
  days: number;
  message: string;
  isUrgent: boolean;
} | null> {
  const eventPhase = await getEventPhase();
  
  if (eventPhase.daysUntilNext === 0) {
    return null;
  }
  
  return {
    days: eventPhase.daysUntilNext,
    message: eventPhase.nextMilestone,
    isUrgent: eventPhase.isUrgent
  };
}
