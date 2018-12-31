import { IOption, Select, Typography } from 'njm-react-component-library';
import * as React from 'react';
import { connect } from 'react-redux';
import { ReduxState } from 'src/reducer';
import { getColors } from 'src/services';
import styled from 'styled-components';
import { Clusters, Map, Parameters } from '../';
import { clusterOptions, clusterTypes } from '../constants';
import {
	getAgglomerativeHierarchicalClustersFromState,
	getPoints
} from '../selectors';
import {
	ClusteredPoint,
	IClusterOption,
	AgglomerativeHierarchicalClusterPoint,
	Point
} from '../types';

export class MapPageInternal extends React.Component<IProps, IState> {
	readonly state = initialState;

	componentWillReceiveProps = (nextProps: IProps) =>
		this.setState({ colors: getColors(nextProps.points.length) });

	handleClusterCountChange = (clusterCount: number) =>
		this.setState({ clusterCount });

	handleClusterTypeChange = (currentClusterOption: IClusterOption) =>
		this.setState({ currentClusterOption });

	render() {
		const { points } = this.props;
		const {
			currentClusterOption,
			clusterCount: clusterCount,
			colors
		} = this.state;

		const markers = getMarkers(
			getPointsForMap(this.state, this.props),
			clusterCount,
			colors,
			currentClusterOption
		);

		return (
			<div>
				<Map markers={markers} />
				<MapControls>
					<InfoPanel>
						<Typography variant="h1">Parameters</Typography>
						<Typography variant="h2">Cluster Type</Typography>
						<Select
							options={clusterOptions}
							onChange={this.handleClusterTypeChange}
							currentOption={currentClusterOption}
							removeNoneOptionAfterSelection={true}
						/>
						<Parameters
							currentClusterOption={currentClusterOption}
							points={points}
							clusterCount={clusterCount}
							onClusterCountChange={this.handleClusterCountChange}
						/>
					</InfoPanel>
					<InfoPanel>
						<Typography variant="h1">Results</Typography>
						<Typography variant="h2">Clusters</Typography>
						<Clusters
							clusteredPoints={getClusters(
								currentClusterOption,
								clusterCount,
								this.props
							)}
						/>
					</InfoPanel>
				</MapControls>
			</div>
		);
	}
}

// redux
const mapStateToProps = (state: ReduxState): IReduxProps => ({
	points: getPoints(state),
	agglomerativeHierarchicalClusters: getAgglomerativeHierarchicalClustersFromState(
		state
	)
});

export const MapPage = connect(
	mapStateToProps,
	null
)(MapPageInternal);

// helpers
const getClusters = (
	currentClusterOption: IOption | null,
	clusterCount: number,
	props: IProps
): ClusteredPoint[] => {
	const unclusteredPoints = props.points.map(p => ({
		...p,
		clusterId: p.pointId
	}));
	if (!currentClusterOption) {
		return unclusteredPoints;
	}
	switch (currentClusterOption.value) {
		case clusterTypes.agglomerativeHierarchicalClusters:
			return props.agglomerativeHierarchicalClusters.map(ahc => {
				return {
					...ahc,
					clusterId:
						ahc.agglomerativeHierarchicalClusterInfos[
							clusterCount - 1
						].clusterId
				};
			});
		default:
			return unclusteredPoints;
	}
};

const getPointsForMap = (
	state: IState,
	props: IProps
): Point[] | AgglomerativeHierarchicalClusterPoint[] => {
	const { currentClusterOption } = state;
	const { agglomerativeHierarchicalClusters, points } = props;
	if (currentClusterOption === null) {
		return points;
	}
	const canShowAgglomerativeHierarchicalClusters =
		props.agglomerativeHierarchicalClusters.length > 0;
	switch (currentClusterOption.value) {
		case clusterTypes.agglomerativeHierarchicalClusters:
			return canShowAgglomerativeHierarchicalClusters
				? agglomerativeHierarchicalClusters
				: points;
		default:
			return points;
	}
};
const getFillColorFunc = (
	currentClusterOption: IOption | null,
	colors: string[],
	value: number
) => {
	const defaultFillColorFunc = (
		p: Point | AgglomerativeHierarchicalClusterPoint
	) => 'red';
	if (!currentClusterOption || colors.length === 0) {
		return defaultFillColorFunc;
	}
	switch (currentClusterOption.value) {
		case clusterTypes.agglomerativeHierarchicalClusters:
			return (p: AgglomerativeHierarchicalClusterPoint) =>
				colors[
					p.agglomerativeHierarchicalClusterInfos[value - 1].clusterId
				];
		default:
			return defaultFillColorFunc;
	}
};
const getMarkers = (
	modeledPoints: Point[],
	value: number,
	colors: string[],
	currentClusterOption: IOption | null
) => {
	if (!modeledPoints.length) {
		return [];
	}
	return modeledPoints.map(mp => ({
		position: {
			lat: mp.verticalDisplacement,
			lng: mp.horizontalDisplacement
		},
		label: {
			text: mp.name
		},
		icon: {
			fillColor: getFillColorFunc(currentClusterOption, colors, value)(mp)
		}
	}));
};

// types
const initialState = {
	clusterCount: 30,
	currentClusterOption: null as IOption | null,
	colors: [] as string[]
};

type IState = typeof initialState;

interface IReduxProps {
	points: Point[];
	agglomerativeHierarchicalClusters: AgglomerativeHierarchicalClusterPoint[];
}

type IProps = IReduxProps;

// css
const InfoPanel = styled.div`
	margin: 0px 16px;
	min-width: 300px;
	min-height: 300px;
`;

const MapControls = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
`;
