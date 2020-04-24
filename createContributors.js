const path = require(`path`)
module.exports = async ({ actions, graphql }) => {
  const GET_CONTRIBUTOR_POSTS = `
    query GET_CONTRIBUTOR_POSTS($first: Int, $after: String, $contributorId: ID) {
      wpgraphql {
        posts(where: {allContributionsByContributor: $contributorId}, first: $first, after: $after) {
          nodes {
            id
            postId
            title
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  `
  const GET_CONTRIBUTOR = `
  query GET_CONTRIBUTOR($first:Int $after:String){
    wpgraphql {
      contributors(
        where: {
          taxQuery: 
            {
              relation: OR, 
                taxArray: [
                  {
                    terms: ["author"], 
                    taxonomy: CONTRIBUTORROLE, 
                    operator: IN, 
                    field: SLUG
                  }, 
                  {
                    terms: ["illustrator"],
                    taxonomy: CONTRIBUTORROLE,
                    operator: IN,
                    field: SLUG
                  }, 
                  {
                    terms: ["speaker"],
                    taxonomy: CONTRIBUTORROLE, 
                    operator: IN, 
                    field: SLUG
                  }, 
                  {
                    terms: ["presenter"], 
                    taxonomy: CONTRIBUTORROLE, 
                    operator: IN, 
                    field: SLUG
                  }
                  ]
                }
              }, first: $first, after: $after) {
          pageInfo {
            endCursor
            hasNextPage
          }
        nodes {
          id
          slug
          title
          contributorId
        }
      }
    }
  }
  `
  const { createPage } = actions
  const allContributors = []
  const allContributorPosts = []
  const blogPages = []

  const fetchContributorPosts = async (variables, slug) =>
    await graphql(GET_CONTRIBUTOR_POSTS, variables).then(({ data }) => {
      const {
        wpgraphql: {
          posts: {
            nodes,
            pageInfo: { hasNextPage, endCursor },
          },
        },
      } = data

      nodes.map(post => {
        allContributorPosts[slug].push(post.postId)
      })

      if (hasNextPage) {
        return fetchContributorPosts(
          {
            first: 12,
            after: endCursor,
            contributorId: variables.contributorId,
            id: variables.id,
          },
          slug
        )
      }

      // If there are no more posts to fetch, start building pages
      if (!hasNextPage) {
        const categoryTemplate = path.resolve(
          `./src/templates/post-contributor.js`
        )
        let pageNumber = 1
        const totalPosts = allContributorPosts[slug].length

        // Run this at least once, since some contributors may not have contributions :shrug
        do {
          const blogPagePath =
            pageNumber <= 1
              ? `/contributor/${slug}/`
              : `/contributor/${slug}/page/${pageNumber}/`

          // Take all the post IDs (WordPress post ID) and chunk them into groups of 12 to feed to create page. Consume
          // the whole array until there is nothing left.
          const firstIds = allContributorPosts[slug].splice(0, 12)
          createPage({
            path: blogPagePath,
            component: categoryTemplate,
            context: {
              id: variables.id,
              ids: firstIds,
              pageNumber: pageNumber,
              hasNextPage: hasNextPage,
              totalPosts: totalPosts,
              totalPages: Math.ceil(totalPosts / 12),
              slug: slug,
            },
          })
          pageNumber++
        } while (allContributorPosts[slug].length > 0)
      }

      return blogPages
    })

  const fetchContributors = async variables =>
    await graphql(GET_CONTRIBUTOR, variables).then(({ data }) => {
      const {
        wpgraphql: {
          contributors: {
            nodes,
            pageInfo: { hasNextPage, endCursor },
          },
        },
      } = data

      nodes.map(post => {
        allContributors.push(post)
      })

      if (hasNextPage) {
        fetchContributors({ first: 12, after: endCursor })
      }

      return allContributors
    })

  // Get every writer, illustrator, speaker, etc
  await fetchContributors({ first: 12, after: null }).then(() => {
    allContributors.forEach(contributor => {
      console.log('contributor: ', contributor)

      // Create an array assigned to this specific contributor inside of all the contributors array
      if (!allContributorPosts[contributor.slug]) {
        allContributorPosts[contributor.slug] = []
      }
      // Get all posts created by this contributor, could be 200 or 12 it doesn't really matter
      fetchContributorPosts(
        {
          first: 200,
          after: null,
          contributorId: contributor.contributorId,
          id: contributor.id,
        },
        contributor.slug
      )
    })
  })
}
