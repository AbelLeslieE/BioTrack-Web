"""Service-team ownership and query scoping for Biomedical and Electrical data."""

from fastapi import HTTPException


SERVICE_TEAMS = {"Biomedical", "Electrical", "IT"}


def team_for_user(current_user, requested_team: str | None = None) -> str | None:
    """Return the enforced team for engineers; managers may work across both teams."""
    if current_user.role == "BME":
        return "Biomedical"
    if current_user.role == "Electrical":
        return "Electrical"
    if current_user.role == "IT":
        return "IT"
    if current_user.role == "Manager":
        if requested_team is None:
            return "Biomedical"
        team = requested_team.strip().title()
        if team in SERVICE_TEAMS:
            return team
        raise HTTPException(status_code=422, detail="Select Biomedical, Electrical, or IT service.")
    raise HTTPException(status_code=403, detail="This role cannot access engineering data.")


def scope_to_team(query, model, current_user):
    """Managers retain oversight; engineers never receive the other team's records."""
    if current_user.role == "BME":
        return query.filter(model.service_team == "Biomedical")
    if current_user.role == "Electrical":
        return query.filter(model.service_team == "Electrical")
    if current_user.role == "IT":
        return query.filter(model.service_team == "IT")
    return query
