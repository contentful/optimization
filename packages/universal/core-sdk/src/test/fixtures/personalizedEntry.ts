import type { Entry } from 'contentful'

export const personalizedEntry: Entry = {
  metadata: {
    tags: [],
    concepts: [],
  },
  sys: {
    space: {
      sys: {
        type: 'Link',
        linkType: 'Space',
        id: 'uelxcuo7v97l',
      },
    },
    id: '4ib0hsHWoSOnCVdDkizE8d',
    type: 'Entry',
    createdAt: '2025-10-13T11:59:56.556Z',
    updatedAt: '2025-10-14T08:28:15.913Z',
    environment: {
      sys: {
        id: 'master',
        type: 'Link',
        linkType: 'Environment',
      },
    },
    publishedVersion: 13,
    revision: 3,
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'content',
      },
    },
    locale: 'en-US',
  },
  fields: {
    internalTitle: '[Baseline] All Visitors from a Continent',
    text: 'This is a baseline content entry for visitors from any continent.',
    nt_experiences: [
      {
        metadata: {
          tags: [],
          concepts: [],
        },
        sys: {
          space: {
            sys: {
              type: 'Link',
              linkType: 'Space',
              id: 'uelxcuo7v97l',
            },
          },
          id: '2qVK4T5lnScbswoyBuGipd',
          type: 'Entry',
          createdAt: '2025-10-13T12:00:52.906Z',
          updatedAt: '2025-10-13T12:04:17.168Z',
          environment: {
            sys: {
              id: 'master',
              type: 'Link',
              linkType: 'Environment',
            },
          },
          publishedVersion: 15,
          revision: 2,
          contentType: {
            sys: {
              type: 'Link',
              linkType: 'ContentType',
              id: 'nt_experience',
            },
          },
          locale: 'en-US',
        },
        fields: {
          nt_name: '[Personalization] Visitors from Europe',
          nt_type: 'nt_personalization',
          nt_config: {
            traffic: 1,
            components: [
              {
                baseline: {
                  id: '4ib0hsHWoSOnCVdDkizE8d',
                },
                variants: [
                  {
                    id: '4k6ZyFQnR2POY5IJLLlJRb',
                    hidden: false,
                  },
                ],
              },
            ],
            distribution: [0, 1],
            primaryMetric: '',
          },
          nt_audience: {
            metadata: {
              tags: [],
              concepts: [],
            },
            sys: {
              space: {
                sys: {
                  type: 'Link',
                  linkType: 'Space',
                  id: 'uelxcuo7v97l',
                },
              },
              id: '2WzXDaWtDmstHl9p8Wufpp',
              type: 'Entry',
              createdAt: '2025-10-13T09:11:33.088Z',
              updatedAt: '2025-10-13T09:11:33.088Z',
              environment: {
                sys: {
                  id: 'master',
                  type: 'Link',
                  linkType: 'Environment',
                },
              },
              publishedVersion: 9,
              revision: 1,
              contentType: {
                sys: {
                  type: 'Link',
                  linkType: 'ContentType',
                  id: 'nt_audience',
                },
              },
              locale: 'en-US',
            },
            fields: {
              nt_name: 'Europe Visitors',
              nt_description: 'Visitors located in Europe',
              nt_rules: {
                any: [
                  {
                    all: [
                      {
                        key: 'continent',
                        type: 'location',
                        count: '1',
                        value: 'EU',
                        operator: 'equal',
                        conditions: [],
                      },
                    ],
                  },
                ],
              },
              nt_audience_id: '2WzXDaWtDmstHl9p8Wufpp',
              nt_metadata: {
                type: 'origin',
              },
            },
          },
          nt_variants: [
            {
              metadata: {
                tags: [],
                concepts: [],
              },
              sys: {
                space: {
                  sys: {
                    type: 'Link',
                    linkType: 'Space',
                    id: 'uelxcuo7v97l',
                  },
                },
                id: '4k6ZyFQnR2POY5IJLLlJRb',
                type: 'Entry',
                createdAt: '2025-10-13T12:00:42.658Z',
                updatedAt: '2025-10-13T12:00:42.658Z',
                environment: {
                  sys: {
                    id: 'master',
                    type: 'Link',
                    linkType: 'Environment',
                  },
                },
                publishedVersion: 5,
                revision: 1,
                contentType: {
                  sys: {
                    type: 'Link',
                    linkType: 'ContentType',
                    id: 'content',
                  },
                },
                locale: 'en-US',
              },
              fields: {
                internalTitle: '[Variant] Visitors from Europe',
                text: 'This is a variant content entry for visitors from Europe.',
              },
            },
          ],
          nt_experience_id: '2qVK4T5lnScbswoyBuGipd',
          nt_metadata: {
            type: 'origin',
          },
        },
      },
      {
        metadata: {
          tags: [],
          concepts: [],
        },
        sys: {
          space: {
            sys: {
              type: 'Link',
              linkType: 'Space',
              id: 'uelxcuo7v97l',
            },
          },
          id: '6KfLDCdA75BGwr5HfSeXac',
          type: 'Entry',
          createdAt: '2025-10-14T08:26:44.114Z',
          updatedAt: '2025-10-14T08:26:44.114Z',
          environment: {
            sys: {
              id: 'master',
              type: 'Link',
              linkType: 'Environment',
            },
          },
          publishedVersion: 15,
          revision: 1,
          contentType: {
            sys: {
              type: 'Link',
              linkType: 'ContentType',
              id: 'nt_experience',
            },
          },
          locale: 'en-US',
        },
        fields: {
          nt_name: '[Personalization] Visitors from North America',
          nt_type: 'nt_personalization',
          nt_config: {
            distribution: [0, 1],
            traffic: 1,
            components: [
              {
                baseline: {
                  id: '4ib0hsHWoSOnCVdDkizE8d',
                },
                variants: [
                  {
                    id: '7Ae0ke0e3YqRLutG35d4Ve',
                    hidden: false,
                  },
                ],
              },
            ],
            primaryMetric: '',
          },
          nt_audience: {
            metadata: {
              tags: [],
              concepts: [],
            },
            sys: {
              space: {
                sys: {
                  type: 'Link',
                  linkType: 'Space',
                  id: 'uelxcuo7v97l',
                },
              },
              id: '5P8sJgSXhjNUlUfk7ee88u',
              type: 'Entry',
              createdAt: '2025-10-13T09:12:58.836Z',
              updatedAt: '2025-10-13T09:12:58.836Z',
              environment: {
                sys: {
                  id: 'master',
                  type: 'Link',
                  linkType: 'Environment',
                },
              },
              publishedVersion: 10,
              revision: 1,
              contentType: {
                sys: {
                  type: 'Link',
                  linkType: 'ContentType',
                  id: 'nt_audience',
                },
              },
              locale: 'en-US',
            },
            fields: {
              nt_name: 'North America Visitors',
              nt_description: 'Visitors located in North America',
              nt_rules: {
                any: [
                  {
                    all: [
                      {
                        type: 'location',
                        count: '1',
                        key: 'continent',
                        operator: 'equal',
                        value: 'NA',
                        conditions: [],
                      },
                    ],
                  },
                ],
              },
              nt_audience_id: '5P8sJgSXhjNUlUfk7ee88u',
              nt_metadata: {
                type: 'origin',
              },
            },
          },
          nt_variants: [
            {
              metadata: {
                tags: [],
                concepts: [],
              },
              sys: {
                space: {
                  sys: {
                    type: 'Link',
                    linkType: 'Space',
                    id: 'uelxcuo7v97l',
                  },
                },
                id: '7Ae0ke0e3YqRLutG35d4Ve',
                type: 'Entry',
                createdAt: '2025-10-14T08:26:28.160Z',
                updatedAt: '2025-10-14T08:26:28.160Z',
                environment: {
                  sys: {
                    id: 'master',
                    type: 'Link',
                    linkType: 'Environment',
                  },
                },
                publishedVersion: 7,
                revision: 1,
                contentType: {
                  sys: {
                    type: 'Link',
                    linkType: 'ContentType',
                    id: 'content',
                  },
                },
                locale: 'en-US',
              },
              fields: {
                internalTitle: '[Variant] Visitors from North America',
                text: 'This is a variant content entry for visitors from North America.',
              },
            },
          ],
          nt_experience_id: '6KfLDCdA75BGwr5HfSeXac',
          nt_metadata: {
            type: 'origin',
          },
        },
      },
    ],
  },
}
