import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { portraitElement, portraitMarkup, type Variant } from './RoleAvatar';

describe('portrait images', () => {
  const variants: Variant[] = ['bust', 'badge'];
  it.each(Object.keys(ROLES) as RoleId[])('%s serializes exactly like React renders it', (roleId) => {
    for (const variant of variants) {
      expect(portraitMarkup(roleId, variant)).toBe(renderToStaticMarkup(portraitElement(roleId, variant)));
    }
  });
});
