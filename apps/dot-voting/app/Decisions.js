import React, { useCallback, useEffect, useState }  from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import Votes from './components/Votes'
import { isBefore } from 'date-fns'
import { useAragonApi } from './api-react'
import { BackButton, Bar, DropDown, GU, textStyle, useLayout, useTheme } from '@aragon/ui'
import VoteDetails from './components/VoteDetails'
import { getQuorumProgress } from './utils/vote-utils'
import { getVoteStatus } from './utils/vote-utils'
import EmptyFilteredVotes from './components/EmptyFilteredVotes'
import {
  VOTE_STATUS_EXECUTED,
  VOTE_STATUS_FAILED,
  VOTE_STATUS_SUCCESSFUL,
} from './utils/vote-types'

const NULL_FILTER_STATE = -1
const STATUS_FILTER_OPEN = 1
const STATUS_FILTER_CLOSED = 2
const OUTCOME_FILTER_PASSED = 1
const OUTCOME_FILTER_REJECTED = 2
const OUTCOME_FILTER_ENACTED = 3
const OUTCOME_FILTER_PENDING = 4
const APP_FILTER_ALLOCATIONS = 1
const APP_FILTER_CURATIONS = 2
const APP_FILTER_INFORMATIONAL = 3

const useFilterVotes = (votes, voteTime) => {
  const [ filteredVotes, setFilteredVotes ] = useState(votes)
  const [ statusFilter, setStatusFilter ] = useState(NULL_FILTER_STATE)
  const [ outcomeFilter, setOutcomeFilter ] = useState(NULL_FILTER_STATE)
  const [ appFilter, setAppFilter ] = useState(NULL_FILTER_STATE)

  const handleClearFilters = useCallback(() => {
    setStatusFilter(NULL_FILTER_STATE)
    setOutcomeFilter(NULL_FILTER_STATE)
    setAppFilter(NULL_FILTER_STATE)
  }, [
    setStatusFilter,
    setOutcomeFilter,
    setAppFilter,
  ])

  useEffect(() => {
    const now = new Date()
    const filtered = votes.filter(vote => {

      const endDate = new Date(vote.data.startDate + voteTime)
      const open = isBefore(now, endDate)
      const type = vote.data.type
      vote.quorumProgress = getQuorumProgress(vote.data)
      const voteStatus = getVoteStatus(vote)

      if (statusFilter !== NULL_FILTER_STATE) {
        if (statusFilter === STATUS_FILTER_OPEN && !isBefore(now, endDate)) return false
        if (statusFilter === STATUS_FILTER_CLOSED && isBefore(now, endDate)) return false
      }

      if (appFilter !== NULL_FILTER_STATE) {
        if (appFilter === APP_FILTER_ALLOCATIONS && type !== 'allocation') return false
        if (appFilter === APP_FILTER_CURATIONS && type !== 'curation') return false
        if (appFilter === APP_FILTER_INFORMATIONAL && type !== 'informational') return false
      }

      if (outcomeFilter !== NULL_FILTER_STATE) {
        if (open) return false
        if (outcomeFilter === OUTCOME_FILTER_PASSED &&
          !(voteStatus === VOTE_STATUS_SUCCESSFUL || voteStatus === VOTE_STATUS_EXECUTED)
        ) return false
        if (outcomeFilter === OUTCOME_FILTER_REJECTED && voteStatus !== VOTE_STATUS_FAILED) return false
        if (outcomeFilter === OUTCOME_FILTER_ENACTED && voteStatus !== VOTE_STATUS_EXECUTED) return false
        if (outcomeFilter === OUTCOME_FILTER_PENDING && voteStatus !== VOTE_STATUS_SUCCESSFUL) return false
      }
      return true
    })

    setFilteredVotes(filtered)
  }, [
    statusFilter,
    outcomeFilter,
    appFilter,
    setFilteredVotes,
    votes,
  ])

  return {
    filteredVotes,
    voteStatusFilter: statusFilter,
    handleVoteStatusFilterChange: useCallback(
      index => {
        setStatusFilter(index || NULL_FILTER_STATE)
      },
      [setStatusFilter]
    ),
    voteOutcomeFilter: outcomeFilter,
    handleVoteOutcomeFilterChange: useCallback(
      index => setOutcomeFilter(index || NULL_FILTER_STATE),
      [setOutcomeFilter]
    ),
    voteAppFilter: appFilter,
    handleVoteAppFilterChange: useCallback(
      index => setAppFilter(index || NULL_FILTER_STATE),
      [setAppFilter]
    ),
    handleClearFilters,
  }
}

const Decisions = ({ decorateVote }) => {
  const { api: app, appState, connectedAccount } = useAragonApi()
  const { votes, voteTime } = appState

  const { layoutName } = useLayout()
  const theme = useTheme()

  // TODO: accomplish this with routing (put routes in App.js, not here)
  const [ currentVoteId, setCurrentVoteId ] = useState(-1)
  const handleVote = useCallback(async (voteId, supports) => {
    await app.vote(voteId, supports).toPromise()
    setCurrentVoteId(-1) // is this correct?
  }, [app])
  const handleBackClick = useCallback(() => {
    setCurrentVoteId(-1)
  }, [])
  const handleVoteOpen = useCallback(voteId => {
    const exists = votes.some(vote => voteId === vote.voteId)
    if (!exists) return
    setCurrentVoteId(voteId)
  }, [votes])

  const {
    filteredVotes,
    voteStatusFilter,
    handleVoteStatusFilterChange,
    voteOutcomeFilter,
    handleVoteOutcomeFilterChange,
    voteAppFilter,
    handleVoteAppFilterChange,
    handleClearFilters,
  } = useFilterVotes(votes, voteTime)

  const currentVote =
      currentVoteId === -1
        ? null
        : decorateVote(
          filteredVotes.find(vote => vote.voteId === currentVoteId)
        )

  if (currentVote) {
    return (
      <React.Fragment>
        <Bar>
          <BackButton onClick={handleBackClick} />
        </Bar>
        <VoteDetails vote={currentVote} onVote={handleVote} />
      </React.Fragment>
    )
  }

  if (!filteredVotes.length) return (
    <EmptyFilteredVotes onClear={handleClearFilters} />
  )

  const preparedVotes = filteredVotes.map(decorateVote)

  return (
    <React.Fragment>
      {layoutName !== 'small' && (
        <Bar>
          <div
            css={`
            height: ${8 * GU}px;
            display: grid;
            grid-template-columns: auto auto auto 1fr;
            grid-gap: ${1 * GU}px;
            align-items: center;
            padding-left: ${3 * GU}px;
          `}
          >
            <DropDown
              header="Status"
              placeholder="Status"
              selected={voteStatusFilter}
              onChange={handleVoteStatusFilterChange}
              items={[
                // eslint-disable-next-line react/jsx-key
                <div>
                All
                  <span
                    css={`
                    margin-left: ${1.5 * GU}px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: ${theme.info};
                    ${textStyle('label3')};
                  `}
                  >
                    <DiscTag>
                      {votes.length > 9999 ? '9999+' : votes.length}
                    </DiscTag>
                  </span>
                </div>,
                'Open',
                'Closed',
              ]}
              width="128px"
            />
            {voteStatusFilter !== STATUS_FILTER_OPEN && (
              <DropDown
                header="Outcome"
                placeholder="Outcome"
                selected={voteOutcomeFilter}
                onChange={handleVoteOutcomeFilterChange}
                items={[ 'All', 'Passed', 'Rejected', 'Enacted', 'Pending' ]}
                width="128px"
              />
            )}
            <DropDown
              header="App type"
              placeholder="App type"
              selected={voteAppFilter}
              onChange={handleVoteAppFilterChange}
              items={[ 'All', 'Allocations', 'Issue Curation', 'Informational' ]}
              width="128px"
            />
          </div>
        </Bar>
      )}

      <Votes
        votes={preparedVotes}
        onSelectVote={handleVoteOpen}
        app={app}
        userAccount={connectedAccount}
      />

    </React.Fragment>
  )
}

Decisions.propTypes = {
  decorateVote: PropTypes.func.isRequired,
}

const DiscTag = styled.span`
  display: inline-flex;
  white-space: nowrap;
  color: rgb(109, 128, 136);
  padding-top: 2px;
  letter-spacing: -0.5px;
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -webkit-box-pack: center;
  justify-content: center;
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -webkit-box-align: center;
  align-items: center;
  width: 18px;
  height: 18px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  background: rgb(220, 234, 239);
  overflow: hidden;
  border-radius: 9px;
`

export default Decisions
