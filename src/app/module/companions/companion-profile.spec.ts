import { companionProfileSelect } from './companion-profile';

describe('companionProfileSelect', () => {
  it('includes the public weekly routine in list and detail responses', () => {
    expect(companionProfileSelect.routine).toEqual({
      select: {
        timezone: true,
        weekly: true,
      },
    });
  });
});
