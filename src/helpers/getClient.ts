import { ClientDto, ProjectDtoImpl } from '../api/interfaces';

export function getClientFromProject(clients: ClientDto[], project: ProjectDtoImpl) {
	return clients.find((client) => client.id === project.clientId);
}
